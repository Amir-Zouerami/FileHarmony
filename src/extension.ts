import FileHarmonyViewProvider from './webViewProviders/FileHarmonyViewProvider';
import WorkspaceStateManager from './stateManager/WorkspaceStateManager';
import MessageHandler from './webViewProviders/MessageHandler';
import SyncManager from './SyncManager';
import { informStatus } from './utils';
import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext) {
	// initialization
	const stateManager = new WorkspaceStateManager(context);
	const syncManager = new SyncManager(stateManager);
	const messageHandler = new MessageHandler(stateManager, syncManager);

	// registering webview provider
	const provider = new FileHarmonyViewProvider(context, messageHandler, stateManager);
	context.subscriptions.push(vscode.window.registerWebviewViewProvider('fileHarmonyView', provider));

	const { sourcePath, targetPath, ignoreList, syncStatus } = stateManager.getState();

	if (syncStatus) {
		// initial dir sync when extension activates
		syncManager.initialDirectorySync(sourcePath, targetPath, ignoreList, syncStatus);

		// registering a watcher
		await syncManager.addSyncWatcher();
	}

	vscode.commands.registerCommand('fileHarmony.toggleSyncStatus', async () => {
		const newSyncStatus = await syncManager.toggleSyncStatus();
		stateManager.updateState({ syncStatus: newSyncStatus });
		provider.updateWebview();
		informStatus(newSyncStatus);
	});

	vscode.commands.registerCommand('fileHarmony.getWatchStatus', () => {
		const currStatus = syncManager.getCurrWatchStatus();
		informStatus(currStatus);
	});

	context.subscriptions.push(syncManager);
	context.subscriptions.push(provider);
}

export function deactivate() {}
