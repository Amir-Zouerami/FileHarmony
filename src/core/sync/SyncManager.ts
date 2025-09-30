import { InvalidPathError, DirectoryNotFoundError, NoWorkspaceOpenError } from '../../shared/errors';
import type { StatusBarManager } from '../../view/status-bar/StatusBarManager';
import { SmartSyncStrategy } from './strategies/SmartSyncStrategy';
import { ForceSyncStrategy } from './strategies/ForceSyncStrategy';
import { FileWatcherService } from './services/FileWatcherService';
import type { IVScodeAdapter } from '../../shared/vscode-adapter';
import { SyncActionHandler } from './services/SyncActionHandler';
import { PreviewCalculator } from './services/PreviewCalculator';
import { FileCopierService } from './services/FileCopierService';
import type { ISyncStrategy } from './strategies/ISyncStrategy';
import type SettingsService from '../state/SettingsService';
import { convertToAbsolutePath } from './sync-utils';
import { ConflictHandler } from './ConflictHandler';
import type { ChangeLog } from '../../shared/types';
import type { Logger } from '../../shared/Logger';
import * as vscode from 'vscode';
import * as fs from 'node:fs';

/**
 * The central orchestrator for all synchronization logic.
 * This class manages the lifecycle of the file watcher, delegates tasks to various
 * specialized services (like strategies, calculators, and handlers), and exposes
 * the main public API for starting, stopping, and previewing syncs.
 */
class SyncManager {
	private stateManager: SettingsService;
	private logger: Logger;
	private pendingConflicts: Set<string> = new Set();

	private conflictHandler: ConflictHandler;
	private actionHandler: SyncActionHandler;
	private fileWatcher: FileWatcherService;
	private previewCalculator: PreviewCalculator;
	private fileCopier: FileCopierService;

	/**
	 * Creates an instance of SyncManager.
	 *
	 * @param stateManager The service for accessing the current extension state.
	 * @param logger The centralized logger.
	 * @param statusBarManager The manager for updating the status bar UI.
	 * @param vscodeAdapter An adapter for showing user-facing dialogs and messages.
	 */
	constructor(
		stateManager: SettingsService,
		logger: Logger,
		statusBarManager: StatusBarManager,
		vscodeAdapter: IVScodeAdapter,
	) {
		this.stateManager = stateManager;
		this.logger = logger;

		this.fileCopier = new FileCopierService();
		this.conflictHandler = new ConflictHandler(this.logger, statusBarManager, this.pendingConflicts, vscodeAdapter);
		this.actionHandler = new SyncActionHandler(
			stateManager,
			logger,
			statusBarManager,
			this.conflictHandler,
			this.fileCopier,
		);
		this.fileWatcher = new FileWatcherService(this.logger);
		this.previewCalculator = new PreviewCalculator(this.logger);
	}

	/**
	 * Updates the `lastSynced` timestamp in the ephemeral workspace state.
	 * @private
	 */
	private _updateLastSyncedTimestamp() {
		const newTimestamp = new Date().toISOString();
		this.stateManager.updateEphemeralState({ lastSynced: newTimestamp });
	}

	/**
	 * Performs a full, one-time bulk synchronization of the source directory to the target directory.
	 * It selects the appropriate strategy ('smart' or 'force') based on the current configuration.
	 */
	async initialDirectorySync() {
		const { sourcePath, targetPath, syncMode } = this.stateManager.getState();
		this.checkSourceAndTarget(sourcePath, targetPath);

		const { resolvedSourcePath, resolvedTargetPath } = convertToAbsolutePath(sourcePath, targetPath);

		this.logger.info(
			`Starting initial directory sync (Mode: ${syncMode}) from "${resolvedSourcePath}" to "${resolvedTargetPath}".`,
		);

		const strategy = this.createSyncStrategy(resolvedSourcePath, resolvedTargetPath);
		await strategy.execute();

		this.logger.info('Initial directory sync completed.');
		this._updateLastSyncedTimestamp();
	}

	/**
	 * Creates an instance of the appropriate sync strategy based on the current `syncMode` setting.
	 *
	 * @private
	 * @param sourceRoot The absolute path to the source directory.
	 * @param targetRoot The absolute path to the target directory.
	 * @returns An object conforming to the `ISyncStrategy` interface.
	 */
	private createSyncStrategy(sourceRoot: string, targetRoot: string): ISyncStrategy {
		const { ignoreList, syncMode, conflictResolution } = this.stateManager.getState();

		if (syncMode === 'force') {
			return new ForceSyncStrategy(sourceRoot, targetRoot, ignoreList, this.logger, this.fileCopier);
		}

		return new SmartSyncStrategy(
			sourceRoot,
			targetRoot,
			ignoreList,
			conflictResolution,
			this.logger,
			this.conflictHandler,
			this.fileCopier,
		);
	}

	/**
	 * Calculates a "dry run" of the sync, determining all pending changes without modifying any files.
	 *
	 * @returns A promise that resolves to an array of `ChangeLog` objects.
	 */
	public async calculatePreview(): Promise<ChangeLog[]> {
		const { sourcePath, targetPath, ignoreList } = this.stateManager.getState();

		this.checkSourceAndTarget(sourcePath, targetPath);
		const { resolvedSourcePath, resolvedTargetPath } = convertToAbsolutePath(sourcePath, targetPath);

		return this.previewCalculator.calculate(resolvedSourcePath, resolvedTargetPath, ignoreList);
	}

	/**
	 * Starts the live file watcher on the source directory.
	 * It validates paths and wires up the `SyncActionHandler` to watcher events.
	 *
	 * @returns A promise that resolves to `true` if the watcher started successfully, `false` otherwise.
	 */

	public async addSyncWatcher(): Promise<boolean> {
		const { sourcePath, targetPath, ignoreList } = this.stateManager.getState();

		try {
			this.checkSourceAndTarget(sourcePath, targetPath);
		} catch (err) {
			if (
				err instanceof DirectoryNotFoundError ||
				err instanceof InvalidPathError ||
				err instanceof NoWorkspaceOpenError
			) {
				this.logger.showError(`${err.message} Sync watcher failed to start.`);
			}
			return false;
		}

		const { resolvedSourcePath, resolvedTargetPath } = convertToAbsolutePath(sourcePath, targetPath);

		this.fileWatcher.start(resolvedSourcePath, ignoreList, {
			onAdd: filePath =>
				this.actionHandler.syncFile(filePath, resolvedSourcePath, resolvedTargetPath, this.pendingConflicts),
			onChange: filePath =>
				this.actionHandler.syncFile(filePath, resolvedSourcePath, resolvedTargetPath, this.pendingConflicts),
			onUnlink: filePath => this.actionHandler.deleteFile(filePath, resolvedSourcePath, resolvedTargetPath),
			onAddDir: dirPath => this.actionHandler.syncDirectory(dirPath, resolvedSourcePath, resolvedTargetPath),
			onUnlinkDir: dirPath => this.actionHandler.deleteDirectory(dirPath, resolvedSourcePath, resolvedTargetPath),
		});

		return true;
	}

	/**
	 * Toggles the live sync watcher on or off.
	 *
	 * @returns A promise that resolves to the new status of the watcher (`true` for on, `false` for off).
	 */
	public async toggleSyncStatus(): Promise<boolean> {
		if (this.fileWatcher.isActive()) {
			await this.dispose();
			return false;
		}

		return await this.addSyncWatcher();
	}

	/**
	 * Gets the current status of the file watcher.
	 *
	 * @returns `true` if the watcher is active, `false` otherwise.
	 */

	public getCurrWatchStatus(): boolean {
		return this.fileWatcher.isActive();
	}

	/**
	 * Disposes of the SyncManager's resources, primarily by stopping the file watcher.
	 * This is called on deactivation or when the user manually stops the sync.
	 */
	public async dispose(): Promise<void> {
		await this.fileWatcher.stop();
		this.pendingConflicts.clear();
	}

	/**
	 * Validates the source and target paths from the configuration.
	 *
	 * @private
	 * @param sourcePath The configured source path.
	 * @param targetPath The configured target path.
	 * @returns `true` if paths are valid.
	 * @throws {NoWorkspaceOpenError} If no workspace is open.
	 * @throws {InvalidPathError} If paths are empty or identical.
	 * @throws {DirectoryNotFoundError} If the source directory does not exist.
	 */
	private checkSourceAndTarget(sourcePath: string, targetPath: string): boolean {
		if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
			throw new NoWorkspaceOpenError();
		}

		if (!sourcePath || !targetPath) {
			throw new InvalidPathError('Source or Target Path cannot be empty!');
		}

		if (sourcePath === targetPath) {
			throw new InvalidPathError('Source and Target Path cannot be the same.');
		}

		const { resolvedSourcePath } = convertToAbsolutePath(sourcePath, targetPath);
		if (!fs.existsSync(resolvedSourcePath)) {
			throw new DirectoryNotFoundError(resolvedSourcePath);
		}

		return true;
	}
}

export default SyncManager;
