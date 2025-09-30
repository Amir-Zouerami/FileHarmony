import type { StatusBarManager } from '../../../view/status-bar/StatusBarManager';
import type SettingsService from '../../state/SettingsService';
import type { FileCopierService } from './FileCopierService';
import type { ConflictHandler } from '../ConflictHandler';
import type { Logger } from '../../../shared/Logger';
import { isIgnored } from '../sync-utils';
import * as path from 'node:path';
import * as fs from 'node:fs';

/**
 * Handles the direct file system actions for synchronization (copy, delete, etc.) for the live watcher.
 * This class contains the core logic for how individual file events from `chokidar` are processed.
 */
export class SyncActionHandler {
	/**
	 * Creates an instance of SyncActionHandler.
	 *
	 * @param stateManager The service for accessing the current extension state.
	 * @param logger The centralized logger.
	 * @param statusBarManager The manager for updating the status bar UI.
	 * @param conflictHandler The service for resolving sync conflicts.
	 * @param fileCopier The service for copying files while preserving metadata.
	 */
	constructor(
		private stateManager: SettingsService,
		private logger: Logger,
		private statusBarManager: StatusBarManager,
		private conflictHandler: ConflictHandler,
		private fileCopier: FileCopierService,
	) {}

	/**
	 * Updates the `lastSynced` timestamp in the ephemeral workspace state.
	 * @private
	 */
	private updateLastSyncedTimestamp(): void {
		const newTimestamp = new Date().toISOString();
		this.stateManager.updateEphemeralState({ lastSynced: newTimestamp });
	}

	/**
	 * Handles a file creation or update event from the watcher.
	 * It checks for conflicts based on the `lastSynced` timestamp and the configured
	 * conflict resolution strategy before performing the copy operation.
	 *
	 * @param filePath The absolute path of the source file that changed.
	 * @param resolvedSourcePath The root source directory.
	 * @param resolvedTargetPath The root target directory.
	 * @param pendingConflicts A set of files currently undergoing 'Ask' mode conflict resolution to prevent race conditions.
	 */
	public async syncFile(
		filePath: string,
		resolvedSourcePath: string,
		resolvedTargetPath: string,
		pendingConflicts: Set<string>,
	): Promise<void> {
		const relativePath = path.relative(resolvedSourcePath, filePath);
		if (pendingConflicts.has(filePath)) return;

		try {
			const { ignoreList, syncMode, lastSynced, conflictResolution } = this.stateManager.getState();
			if (isIgnored(relativePath, ignoreList)) return;

			const lastSyncedTimestamp = lastSynced ? new Date(lastSynced).getTime() : 0;
			const targetFile = path.join(resolvedTargetPath, relativePath);

			await fs.promises.mkdir(path.dirname(targetFile), { recursive: true });
			let shouldCopy = false;

			if (syncMode === 'force') {
				shouldCopy = true;
			} else if (!fs.existsSync(targetFile)) {
				shouldCopy = true;
			} else {
				const targetStat = await fs.promises.stat(targetFile);
				if (targetStat.mtimeMs > lastSyncedTimestamp) {
					shouldCopy = await this.conflictHandler.handleConflict(
						filePath,
						targetFile,
						relativePath,
						conflictResolution,
					);
				} else {
					shouldCopy = true;
				}
			}

			if (shouldCopy) {
				await this.fileCopier.copyFileWithMetadata(filePath, targetFile);
				this.logger.info(`Synced file: ${relativePath}`);
				this.updateLastSyncedTimestamp();
			}
		} catch (err) {
			const errorMessage = `Failed to sync file '${relativePath}'. Check permissions.`;
			this.logger.error(errorMessage, err);
			this.statusBarManager.update('error', errorMessage);
		}
	}

	/**
	 * Handles a file deletion event from the watcher.
	 * It deletes the corresponding file in the target directory if it exists.
	 *
	 * @param filePath The absolute path of the source file that was deleted.
	 * @param resolvedSourcePath The root source directory.
	 * @param resolvedTargetPath The root target directory.
	 */
	public async deleteFile(filePath: string, resolvedSourcePath: string, resolvedTargetPath: string): Promise<void> {
		const relativePath = path.relative(resolvedSourcePath, filePath);
		const targetFile = path.join(resolvedTargetPath, relativePath);

		try {
			if (fs.existsSync(targetFile)) {
				await fs.promises.unlink(targetFile);
				this.logger.info(`Deleted file: ${relativePath}`);
				this.updateLastSyncedTimestamp();
			}
		} catch (err) {
			const errorMessage = `Failed to delete file '${relativePath}'. Check permissions.`;
			this.logger.error(errorMessage, err);
			this.statusBarManager.update('error', errorMessage);
		}
	}

	/**
	 * Handles a directory creation event from the watcher.
	 * It creates the corresponding directory in the target.
	 *
	 * @param dirPath The absolute path of the source directory that was created.
	 * @param resolvedSourcePath The root source directory.
	 * @param resolvedTargetPath The root target directory.
	 */
	public async syncDirectory(dirPath: string, resolvedSourcePath: string, resolvedTargetPath: string): Promise<void> {
		const relativePath = path.relative(resolvedSourcePath, dirPath);
		const targetDir = path.join(resolvedTargetPath, relativePath);

		try {
			await fs.promises.mkdir(targetDir, { recursive: true });
			this.logger.info(`Synced directory: ${relativePath}`);
		} catch (err) {
			const errorMessage = `Failed to create directory '${relativePath}'. Check permissions.`;
			this.logger.error(errorMessage, err);
			this.statusBarManager.update('error', errorMessage);
		}
	}

	/**
	 * Handles a directory deletion event from the watcher.
	 * It recursively deletes the corresponding directory in the target.
	 *
	 * @param dirPath The absolute path of the source directory that was deleted.
	 * @param resolvedSourcePath The root source directory.
	 * @param resolvedTargetPath The root target directory.
	 */
	public async deleteDirectory(
		dirPath: string,
		resolvedSourcePath: string,
		resolvedTargetPath: string,
	): Promise<void> {
		const relativePath = path.relative(resolvedSourcePath, dirPath);
		const targetDir = path.join(resolvedTargetPath, relativePath);

		try {
			if (fs.existsSync(targetDir)) {
				await fs.promises.rm(targetDir, { recursive: true, force: true });
				this.logger.info(`Deleted directory: ${relativePath}`);
			}
		} catch (err) {
			const errorMessage = `Failed to delete directory '${relativePath}'. Check permissions.`;
			this.logger.error(errorMessage, err);
			this.statusBarManager.update('error', errorMessage);
		}
	}
}
