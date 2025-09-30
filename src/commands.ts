import { DirectoryNotFoundError, InvalidPathError, NoWorkspaceOpenError } from './shared/errors';
import type ControlPanelViewProvider from './view/control-panel/ControlPanelViewProvider';
import { LogViewerPanelManager } from './view/log-viewer/LogViewerPanelManager';
import type { StatusBarManager } from './view/status-bar/StatusBarManager';
import type SettingsService from './core/state/SettingsService';
import type SyncManager from './core/sync/SyncManager';
import { COMMAND_IDS } from './shared/constants';
import type { Logger } from './shared/Logger';
import * as vscode from 'vscode';

/**
 * Interface defining the services required by the command registration function.
 * This structure facilitates dependency injection.
 */
export interface CommandServices {
	syncManager: SyncManager;
	statusBarManager: StatusBarManager;
	settingsService: SettingsService;
	controlPanelViewProvider: ControlPanelViewProvider;
	logger: Logger;
	extensionUri: vscode.Uri;
}

/**
 * Registers all of the extension's commands with VS Code.
 * This function is called once during extension activation.
 *
 * @param context The extension context provided by VS Code.
 * @param services An object containing all the necessary services for the commands to function.
 */
export function registerCommands(context: vscode.ExtensionContext, services: CommandServices) {
	const { syncManager, statusBarManager, settingsService, controlPanelViewProvider, logger, extensionUri } = services;

	context.subscriptions.push(
		vscode.commands.registerCommand(COMMAND_IDS.CLEAR_ERROR_STATE, () => {
			const currentSyncStatus = syncManager.getCurrWatchStatus();
			statusBarManager.clearErrorStateAndSet(currentSyncStatus ? 'active' : 'inactive');
			logger.showInfo('Error state has been cleared.');
		}),

		vscode.commands.registerCommand(COMMAND_IDS.SHOW_LOG_VIEWER, () => {
			LogViewerPanelManager.createOrShow(extensionUri);
		}),

		vscode.commands.registerCommand(COMMAND_IDS.TOGGLE_SYNC_STATUS, async () => {
			const newSyncStatus = await syncManager.toggleSyncStatus();
			await settingsService.updateEphemeralState({ syncStatus: newSyncStatus });

			controlPanelViewProvider.updateWebview();
			logger.showInfo(`Sync Watcher ${newSyncStatus ? 'Activated' : 'Deactivated'}.`);
			statusBarManager.update(newSyncStatus ? 'active' : 'inactive');
		}),

		vscode.commands.registerCommand(COMMAND_IDS.GET_WATCH_STATUS, () => {
			const currStatus = syncManager.getCurrWatchStatus();
			logger.showInfo(`Watch Status is currently: ${currStatus ? 'Active' : 'Inactive'}.`);
		}),

		vscode.commands.registerCommand(COMMAND_IDS.SYNC_NOW, async () => {
			const currentSyncStatus = syncManager.getCurrWatchStatus();
			statusBarManager.clearErrorStateAndSet(currentSyncStatus ? 'active' : 'inactive');
			statusBarManager.update('syncing');

			try {
				await syncManager.initialDirectorySync();
				const newState = settingsService.getState();

				await settingsService.updateEphemeralState({ lastSynced: new Date().toISOString() });
				controlPanelViewProvider.updateWebviewWithState(newState);
			} catch (err) {
				if (err instanceof NoWorkspaceOpenError) {
					logger.showError('Please open a folder before running a sync.');
				} else if (err instanceof DirectoryNotFoundError || err instanceof InvalidPathError) {
					logger.showError(err.message);
				} else {
					logger.error('Manual sync failed.', err);
				}

				statusBarManager.update('error', 'Manual sync failed');
			} finally {
				const newSyncStatus = syncManager.getCurrWatchStatus();
				statusBarManager.update(newSyncStatus ? 'active' : 'inactive');
			}
		}),
	);
}
