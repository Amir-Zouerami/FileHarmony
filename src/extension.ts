import WorkspaceStateManager from './services/WorkspaceStateManager';
import FileHarmonyViewProvider from './ui/FileHarmonyViewProvider';
import { StatusBarManager } from './statusBar/StatusBarManager';
import MessageHandler from './ui/MessageHandler';
import SyncManager from './services/SyncManager';
import { Logger } from './logger/Logger';
import { LogViewerPanelManager } from './ui/LogViewerPanelManager';
import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext) {
	const logger = new Logger('File Harmony');
	const statusBarManager = new StatusBarManager();
	const stateManager = new WorkspaceStateManager(context);
	const syncManager = new SyncManager(stateManager, logger);
	const messageHandler = new MessageHandler(stateManager, syncManager, logger);

	// --- Wire up the Logger to the new LogViewerPanelManager ---
	logger.setUiLogCallback(logMessage => {
		const match = logMessage.match(/\[(INFO|WARN|ERROR)/);
		const level = (match ? match[1] : 'INFO') as 'INFO' | 'WARN' | 'ERROR';
		LogViewerPanelManager.postMessage({ command: 'log', level, message: logMessage });
	});

	const provider = new FileHarmonyViewProvider(context, messageHandler, stateManager);
	context.subscriptions.push(vscode.window.registerWebviewViewProvider('fileHarmonyView', provider));

	// --- Initial Status on Activation ---
	const { syncStatus } = stateManager.getState();
	statusBarManager.update(syncStatus ? 'active' : 'inactive');

	if (syncStatus) {
		try {
			statusBarManager.update('syncing');
			await syncManager.initialDirectorySync();
			await syncManager.addSyncWatcher();
			statusBarManager.update('active');
		} catch (err) {
			logger.showError('Failed during startup sync.', err);
			statusBarManager.update('error', 'Startup sync failed.');
		}
	}

	// --- COMMAND REGISTRATION ---
	context.subscriptions.push(
		vscode.commands.registerCommand('fileHarmony.showLogViewer', () => {
			LogViewerPanelManager.createOrShow(context.extensionUri);
		}),

		vscode.commands.registerCommand('fileHarmony.toggleSyncStatus', async () => {
			const newSyncStatus = await syncManager.toggleSyncStatus();
			stateManager.updateState({ syncStatus: newSyncStatus });
			provider.updateWebview();
			logger.showInfo(`Sync Watcher ${newSyncStatus ? 'Activated' : 'Deactivated'}.`);
			statusBarManager.update(newSyncStatus ? 'active' : 'inactive');
		}),

		vscode.commands.registerCommand('fileHarmony.getWatchStatus', () => {
			const currStatus = syncManager.getCurrWatchStatus();
			logger.showInfo(`Watch Status is currently: ${currStatus ? 'Active' : 'Inactive'}.`);
		}),

		vscode.commands.registerCommand('fileHarmony.syncNowWithFeedback', async () => {
			statusBarManager.update('syncing');
			try {
				await syncManager.initialDirectorySync();
				const newState = stateManager.getState();
				provider.updateWebviewWithState(newState);
			} catch (err) {
				logger.error('Manual sync failed.', err);
			} finally {
				const currentSyncStatus = syncManager.getCurrWatchStatus();
				statusBarManager.update(currentSyncStatus ? 'active' : 'inactive');
			}
		}),
	);

	context.subscriptions.push(logger, statusBarManager, syncManager, provider);
}

export function deactivate() {
	LogViewerPanelManager.dispose();
}
