import WorkspaceStateManager from './stateManager/WorkspaceStateManager';
import { showErrorMessage } from './utils';
import * as vscode from 'vscode';
import chokidar, { FSWatcher } from 'chokidar';
import * as path from 'path';
import * as fs from 'fs';

class SyncManager {
	private watcher?: FSWatcher;
	private stateManager: WorkspaceStateManager;

	constructor(stateManager: WorkspaceStateManager) {
		this.stateManager = stateManager;
	}

	initialDirectorySync(sourcePath: string, targetPath: string, ignoreList: string[], syncStatus: boolean) {
		const check = this.checkSourceAndTarget(sourcePath, targetPath, syncStatus);
		if (!check) return false;

		const { resolvedSourcePath, resolvedTargetPath } = this.convertToAbsolutePath(sourcePath, targetPath);
		const entries = fs.readdirSync(resolvedSourcePath, { withFileTypes: true });

		for (const entry of entries) {
			const sourceEntryPath = path.join(resolvedSourcePath, entry.name);
			const targetEntryPath = path.join(resolvedTargetPath, entry.name);

			if (this.isIgnored(entry.name, ignoreList)) {
				continue;
			}

			if (entry.isDirectory()) {
				this.initialDirectorySync(sourceEntryPath, targetEntryPath, ignoreList, syncStatus);
			} else if (entry.isFile()) {
				fs.mkdirSync(path.dirname(targetEntryPath), { recursive: true });

				if (!fs.existsSync(targetEntryPath) || fs.statSync(sourceEntryPath).mtimeMs > fs.statSync(targetEntryPath).mtimeMs) {
					fs.copyFileSync(sourceEntryPath, targetEntryPath);
					console.log(`File Harmony --> Synced file: ${sourceEntryPath} -> ${targetEntryPath}`);
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

		this.watcher = chokidar.watch(resolvedSourcePath, {
			ignored: ignoreList.map(ignore => path.join(resolvedSourcePath, ignore)),
			persistent: true,
			ignoreInitial: true,
			awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 10 },
		});

		this.watcher
			.on('add', filePath => this.syncFile(filePath, resolvedSourcePath, resolvedTargetPath, ignoreList))
			.on('change', filePath => this.syncFile(filePath, resolvedSourcePath, resolvedTargetPath, ignoreList))
			.on('unlink', filePath => this.deleteFile(filePath, resolvedSourcePath, resolvedTargetPath))
			.on('addDir', dirPath => this.syncDirectory(dirPath, resolvedSourcePath, resolvedTargetPath))
			.on('unlinkDir', dirPath => this.deleteDirectory(dirPath, resolvedSourcePath, resolvedTargetPath))
			.on('error', error => console.error('Watcher error:', error));

		return true;
	}

	private syncFile(filePath: string, resolvedSourcePath: string, resolvedTargetPath: string, ignoreList: string[]) {
		const relativePath = path.relative(resolvedSourcePath, filePath);
		const targetFile = path.join(resolvedTargetPath, relativePath);

		if (this.isIgnored(relativePath, ignoreList)) return;

		fs.mkdirSync(path.dirname(targetFile), { recursive: true });
		fs.copyFile(filePath, targetFile, err => {
			if (err) {
				console.error(`Error syncing file ${relativePath}:`, err);
			} else {
				console.log(`Synced file: ${relativePath}`);
			}
		});
	}

	private deleteFile(filePath: string, resolvedSourcePath: string, resolvedTargetPath: string) {
		const relativePath = path.relative(resolvedSourcePath, filePath);
		const targetFile = path.join(resolvedTargetPath, relativePath);

		if (fs.existsSync(targetFile)) {
			fs.unlink(targetFile, err => {
				if (err) {
					console.error(`Error deleting file ${relativePath}:`, err);
				} else {
					console.log(`Deleted file: ${relativePath}`);
				}
			});
		}
	}

	private syncDirectory(dirPath: string, resolvedSourcePath: string, resolvedTargetPath: string) {
		const relativePath = path.relative(resolvedSourcePath, dirPath);
		const targetDir = path.join(resolvedTargetPath, relativePath);

		fs.mkdirSync(targetDir, { recursive: true });
		console.log(`Synced directory: ${relativePath}`);
	}

	private deleteDirectory(dirPath: string, resolvedSourcePath: string, resolvedTargetPath: string) {
		const relativePath = path.relative(resolvedSourcePath, dirPath);
		const targetDir = path.join(resolvedTargetPath, relativePath);

		if (fs.existsSync(targetDir)) {
			fs.rm(targetDir, { recursive: true, force: true }, err => {
				if (err) {
					console.error(`Error deleting directory ${relativePath}:`, err);
				} else {
					console.log(`Deleted directory: ${relativePath}`);
				}
			});
		}
	}

	async toggleSyncStatus() {
		if (this.watcher) {
			await this.dispose();
			return false;
		} else {
			return await this.addSyncWatcher(true);
		}
	}

	getCurrWatchStatus() {
		if (this.watcher) return true;
		return false;
	}

	async dispose() {
		await this.watcher?.close();
		this.watcher = undefined;
		console.log('Sync stopped');
	}

	private isIgnored(filename: string, ignoreList: string[]) {
		return ignoreList.some(fileOrDir => filename === fileOrDir);
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
			if (syncStatus || isToggleCommand) showErrorMessage('Source Path or Target Path cannot be empty! Adding sync watchers failed!');
			return false;
		}

		if (sourcePath === targetPath) {
			showErrorMessage('Source Path and Target Path cannot be equal!');
			return false;
		}

		if (!fs.existsSync(sourcePath)) {
			if (syncStatus || isToggleCommand) showErrorMessage('Source directory does not exist! Adding sync watchers failed!');
			return false;
		}

		return true;
	}
}

export default SyncManager;
