import WorkspaceStateManager from './services/WorkspaceStateManager';
import FileHarmonyViewProvider from './ui/FileHarmonyViewProvider';
import { StatusBarManager } from './statusBar/StatusBarManager';
import MessageHandler from './ui/MessageHandler';
import SyncManager from './services/SyncManager';
import { Logger } from './logger/Logger';
import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext) {
	// --- Initialization of new services ---
	const logger = new Logger('File Harmony');
	const statusBarManager = new StatusBarManager();

	// --- Injecting logger into services that need it ---
	const stateManager = new WorkspaceStateManager(context);
	const syncManager = new SyncManager(stateManager, logger);
	const messageHandler = new MessageHandler(stateManager, syncManager, logger);

	// Registering webview provider (no changes here)
	const provider = new FileHarmonyViewProvider(context, messageHandler, stateManager);
	context.subscriptions.push(vscode.window.registerWebviewViewProvider('fileHarmonyView', provider));

	// --- Initial Status on Activation ---
	const { sourcePath, targetPath, ignoreList, syncStatus } = stateManager.getState();
	statusBarManager.update(syncStatus ? 'active' : 'inactive');

	if (syncStatus) {
		try {
			statusBarManager.update('syncing');

			await syncManager.initialDirectorySync(sourcePath, targetPath, ignoreList, syncStatus);
			await syncManager.addSyncWatcher();

			statusBarManager.update('active');
		} catch (err) {
			logger.showError('Failed during startup sync.', err);
			statusBarManager.update('error', 'Startup sync failed.');
		}
	}

	// --- Commands using new services ---
	vscode.commands.registerCommand('fileHarmony.toggleSyncStatus', async () => {
		const newSyncStatus = await syncManager.toggleSyncStatus();
		stateManager.updateState({ syncStatus: newSyncStatus });
		provider.updateWebview();

		logger.showInfo(`Sync Watcher ${newSyncStatus ? 'Activated' : 'Deactivated'}.`);
		statusBarManager.update(newSyncStatus ? 'active' : 'inactive');
	});

	vscode.commands.registerCommand('fileHarmony.getWatchStatus', () => {
		const currStatus = syncManager.getCurrWatchStatus();
		logger.showInfo(`Watch Status is currently: ${currStatus ? 'Active' : 'Inactive'}.`);
	});

	// --- Adding new services to subscriptions for proper disposal ---
	context.subscriptions.push(logger, statusBarManager, syncManager, provider);
}

export function deactivate() {}
