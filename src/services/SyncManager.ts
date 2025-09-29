import type WorkspaceStateManager from './WorkspaceStateManager';
import chokidar, { type FSWatcher } from 'chokidar';
import type { Logger } from '../logger/Logger';
import micromatch from 'micromatch';
import * as path from 'node:path';
import * as vscode from 'vscode';
import * as fs from 'node:fs';

class SyncManager {
	private watcher?: FSWatcher;
	private stateManager: WorkspaceStateManager;
	private logger: Logger;

	constructor(stateManager: WorkspaceStateManager, logger: Logger) {
		this.stateManager = stateManager;
		this.logger = logger;
	}

	private _updateLastSyncedTimestamp() {
		const newTimestamp = new Date().toISOString();
		this.stateManager.updateState({ lastSynced: newTimestamp });
	}

	async initialDirectorySync() {
		const { sourcePath, targetPath, ignoreList, syncStatus, syncMode } = this.stateManager.getState();

		const check = this.checkSourceAndTarget(sourcePath, targetPath, syncStatus);
		if (!check) return false;

		const { resolvedSourcePath, resolvedTargetPath } = this.convertToAbsolutePath(sourcePath, targetPath);
		this.logger.info(
			`Starting initial directory sync (Mode: ${syncMode}) from "${resolvedSourcePath}" to "${resolvedTargetPath}".`,
		);

		await this.recursiveSync(resolvedSourcePath, resolvedTargetPath, ignoreList, resolvedSourcePath, syncMode);
		this.logger.info('Initial directory sync completed.');
		this._updateLastSyncedTimestamp();
	}

	private async recursiveSync(
		currentSource: string,
		currentTarget: string,
		ignoreList: string[],
		rootSource: string,
		syncMode: 'smart' | 'force',
	) {
		const entries = await fs.promises.readdir(currentSource, { withFileTypes: true });

		for (const entry of entries) {
			const sourceEntryPath = path.join(currentSource, entry.name);
			const relativePath = path.relative(rootSource, sourceEntryPath);

			if (this.isIgnored(relativePath, ignoreList)) {
				continue;
			}

			const targetEntryPath = path.join(currentTarget, entry.name);

			if (entry.isDirectory()) {
				await fs.promises.mkdir(targetEntryPath, { recursive: true });
				await this.recursiveSync(sourceEntryPath, targetEntryPath, ignoreList, rootSource, syncMode);
			} else if (entry.isFile()) {
				await fs.promises.mkdir(path.dirname(targetEntryPath), { recursive: true });

				try {
					let shouldCopy = false;
					if (syncMode === 'force') {
						shouldCopy = true;
					} else {
						const targetExists = fs.existsSync(targetEntryPath);

						if (
							!targetExists ||
							(await fs.promises.stat(sourceEntryPath)).mtimeMs >
								(await fs.promises.stat(targetEntryPath)).mtimeMs
						) {
							shouldCopy = true;
						}
					}

					if (shouldCopy) {
						await fs.promises.copyFile(sourceEntryPath, targetEntryPath);
						this.logger.info(`Synced file: ${relativePath}`);
					}
				} catch (err) {
					this.logger.error(`Failed to sync file: ${relativePath}`, err);
				}
			}
		}
	}

	async addSyncWatcher(isToggleCommand = false) {
		if (this.watcher) await this.dispose();
		const { sourcePath, targetPath, ignoreList, syncStatus } = this.stateManager.getState();

		const check = this.checkSourceAndTarget(sourcePath, targetPath, syncStatus, isToggleCommand);
		if (!check) return false;

		const { resolvedSourcePath, resolvedTargetPath } = this.convertToAbsolutePath(sourcePath, targetPath);
		this.logger.info(`Adding sync watcher to: ${resolvedSourcePath}`);

		this.watcher = chokidar.watch(resolvedSourcePath, {
			// chokidar natively supports glob patterns, so we just pass them in
			ignored: ignoreList,
			persistent: true,
			ignoreInitial: true,
			awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 10 },
		});

		this.watcher
			.on('add', filePath => this.syncFile(filePath, resolvedSourcePath, resolvedTargetPath))
			.on('change', filePath => this.syncFile(filePath, resolvedSourcePath, resolvedTargetPath))
			.on('unlink', filePath => this.deleteFile(filePath, resolvedSourcePath, resolvedTargetPath))
			.on('addDir', dirPath => this.syncDirectory(dirPath, resolvedSourcePath, resolvedTargetPath))
			.on('unlinkDir', dirPath => this.deleteDirectory(dirPath, resolvedSourcePath, resolvedTargetPath))
			.on('error', error => this.logger.error('Watcher error:', error));

		return true;
	}

	private syncFile(filePath: string, resolvedSourcePath: string, resolvedTargetPath: string) {
		const { ignoreList, syncMode } = this.stateManager.getState();
		const relativePath = path.relative(resolvedSourcePath, filePath);

		// The watcher already filters based on the ignore list, but this is a good safeguard
		if (this.isIgnored(relativePath, ignoreList)) return;

		const targetFile = path.join(resolvedTargetPath, relativePath);

		const performCopy = () => {
			fs.copyFile(filePath, targetFile, err => {
				if (err) this.logger.error(`Error syncing file ${relativePath}:`, err);
				else this.logger.info(`Synced file: ${relativePath}`);
				this._updateLastSyncedTimestamp();
			});
		};

		fs.mkdir(path.dirname(targetFile), { recursive: true }, err => {
			if (err) return this.logger.error(`Error creating directory for ${relativePath}:`, err);

			if (syncMode === 'force') {
				performCopy();
			} else {
				fs.stat(targetFile, (err, targetStats) => {
					if (err || fs.statSync(filePath).mtimeMs > targetStats.mtimeMs) {
						performCopy();
					}
				});
			}
		});
	}

	private deleteFile(filePath: string, resolvedSourcePath: string, resolvedTargetPath: string) {
		const relativePath = path.relative(resolvedSourcePath, filePath);
		const targetFile = path.join(resolvedTargetPath, relativePath);

		if (fs.existsSync(targetFile)) {
			fs.unlink(targetFile, err => {
				if (err) {
					this.logger.error(`Error deleting file ${relativePath}:`, err);
				} else {
					this.logger.info(`Deleted file: ${relativePath}`);
					this._updateLastSyncedTimestamp();
				}
			});
		}
	}

	private syncDirectory(dirPath: string, resolvedSourcePath: string, resolvedTargetPath: string) {
		const relativePath = path.relative(resolvedSourcePath, dirPath);
		const targetDir = path.join(resolvedTargetPath, relativePath);

		fs.mkdir(targetDir, { recursive: true }, err => {
			if (err) this.logger.error(`Error creating directory ${relativePath}:`, err);
			else this.logger.info(`Synced directory: ${relativePath}`);
		});
	}

	private deleteDirectory(dirPath: string, resolvedSourcePath: string, resolvedTargetPath: string) {
		const relativePath = path.relative(resolvedSourcePath, dirPath);
		const targetDir = path.join(resolvedTargetPath, relativePath);

		if (fs.existsSync(targetDir)) {
			fs.rm(targetDir, { recursive: true, force: true }, err => {
				if (err) this.logger.error(`Error deleting directory ${relativePath}:`, err);
				else this.logger.info(`Deleted directory: ${relativePath}`);
			});
		}
	}

	async toggleSyncStatus() {
		if (this.watcher) {
			await this.dispose();
			return false;
		}
		return await this.addSyncWatcher(true);
	}

	getCurrWatchStatus() {
		return !!this.watcher;
	}

	async dispose() {
		if (this.watcher) {
			await this.watcher.close();
			this.watcher = undefined;
			this.logger.info('Sync watcher stopped.');
		}
	}

	private isIgnored(filePath: string, ignoreList: string[]) {
		const normalizedPath = filePath.replace(/\\/g, '/');
		return micromatch.isMatch(normalizedPath, ignoreList);
	}

	private convertToAbsolutePath(sourcePath: string, targetPath: string) {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
		return {
			resolvedSourcePath: path.isAbsolute(sourcePath) ? sourcePath : path.resolve(workspaceFolder, sourcePath),
			resolvedTargetPath: path.isAbsolute(targetPath) ? targetPath : path.resolve(workspaceFolder, targetPath),
		};
	}

	private checkSourceAndTarget(sourcePath: string, targetPath: string, syncStatus: boolean, isToggleCommand = false) {
		if (!sourcePath || !targetPath) {
			if (syncStatus || isToggleCommand)
				this.logger.showError('Source or Target Path cannot be empty! Sync watcher failed to start.');
			return false;
		}

		if (sourcePath === targetPath) {
			this.logger.showError('Source and Target Path cannot be the same.');
			return false;
		}

		const { resolvedSourcePath } = this.convertToAbsolutePath(sourcePath, targetPath);
		if (!fs.existsSync(resolvedSourcePath)) {
			if (syncStatus || isToggleCommand)
				this.logger.showError(`Source directory does not exist: ${resolvedSourcePath}`);
			return false;
		}

		return true;
	}
}

export default SyncManager;
