import ControlPanelViewProvider from './view/control-panel/ControlPanelViewProvider';
import { LogViewerPanelManager } from './view/log-viewer/LogViewerPanelManager';
import { PreviewPanelManager } from './view/preview-panel/PreviewPanelManager';
import { DirectoryNotFoundError, InvalidPathError } from './shared/errors';
import { StatusBarManager } from './view/status-bar/StatusBarManager';
import SettingsService from './core/state/SettingsService';
import { WEBVIEW_MESSAGES_TO } from './shared/constants';
import { VScodeAdapter } from './shared/vscode-adapter';
import SyncManager from './core/sync/SyncManager';
import { VIEW_IDS } from './shared/constants';
import { registerCommands } from './commands';
import { Logger } from './shared/Logger';
import * as vscode from 'vscode';

/**
 * The main entry point for the extension.
 * This function is called by VS Code when the extension is activated. It is responsible for
 * initializing all services, registering commands and UI components (like the webview provider),
 * and starting the initial sync if configured to do so.
 *
 * @param context The extension context provided by VS Code.
 */
export async function activate(context: vscode.ExtensionContext) {
	const vscodeAdapter = new VScodeAdapter();
	const logger = new Logger('File Harmony', vscodeAdapter);
	const statusBarManager = new StatusBarManager();
	const settingsService = new SettingsService(context);
	await settingsService.performOneTimeMigration();

	const syncManager = new SyncManager(settingsService, logger, statusBarManager, vscodeAdapter);

	const controlPanelViewProvider = new ControlPanelViewProvider(
		context,
		settingsService,
		syncManager,
		logger,
		vscodeAdapter,
	);

	logger.setUiLogCallback(logMessage => {
		const match = logMessage.match(/\[(INFO|WARN|ERROR)/);
		const level = (match ? match[1] : 'INFO') as 'INFO' | 'WARN' | 'ERROR';
		LogViewerPanelManager.postMessage({ command: WEBVIEW_MESSAGES_TO.LOG, level, message: logMessage });
	});

	const { syncStatus } = settingsService.getState();
	statusBarManager.update(syncStatus ? 'active' : 'inactive');

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(VIEW_IDS.CONTROL_PANEL, controlPanelViewProvider),
	);

	registerCommands(context, {
		syncManager,
		statusBarManager,
		settingsService,
		controlPanelViewProvider,
		logger,
		extensionUri: context.extensionUri,
	});

	if (syncStatus) {
		try {
			statusBarManager.update('syncing');
			await syncManager.initialDirectorySync();
			await syncManager.addSyncWatcher();
			statusBarManager.update('active');
		} catch (err) {
			if (err instanceof DirectoryNotFoundError || err instanceof InvalidPathError) {
				logger.showError(err.message);
			} else {
				logger.showError('Failed during startup sync.', err);
			}

			statusBarManager.update('error', 'Startup sync failed.');
		}
	}

	context.subscriptions.push(logger, statusBarManager, syncManager, controlPanelViewProvider);
}

/**
 * The exit point for the extension.
 * This function is called by VS Code when the extension is deactivated. It is responsible
 * for cleaning up any disposable resources, such as webview panels.
 */
export function deactivate() {
	LogViewerPanelManager.dispose();
	PreviewPanelManager.dispose();
}
