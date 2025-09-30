import { WEBVIEW_MESSAGES_FROM, WEBVIEW_MESSAGES_TO, COMMAND_IDS } from '../../shared/constants';
import type { Message, SelectFolderMessage, UpdateStateMessage } from '../../shared/types';
import { PreviewPanelManager } from '../preview-panel/PreviewPanelManager';
import type SettingsService from '../../core/state/SettingsService';
import type { IVScodeAdapter } from '../../shared/vscode-adapter';
import type SyncManager from '../../core/sync/SyncManager';
import { NoWorkspaceOpenError } from '../../shared/errors';
import type { WorkspaceState } from '../../shared/types';
import type { Logger } from '../../shared/Logger';
import { getWebviewHtml } from './webview-utils';
import * as vscode from 'vscode';
import fs from 'node:fs';

/**
 * Provides the webview for the main "Control Panel" UI in the activity bar.
 * This class is responsible for creating the webview, managing its lifecycle,
 * handling messages between the webview and the extension, and keeping the UI
 * synchronized with the extension's state.
 */
class ControlPanelViewProvider implements vscode.WebviewViewProvider {
	private disposables: vscode.Disposable[] = [];
	private _view?: vscode.WebviewView;

	private stateManager: SettingsService;
	private syncManager: SyncManager;
	private logger: Logger;
	private readonly extensionUri: vscode.Uri;
	private vscodeAdapter: IVScodeAdapter;

	/**
	 * Creates an instance of ControlPanelViewProvider.
	 *
	 * @param context The extension context.
	 * @param stateManager The service for managing extension state.
	 * @param syncManager The central orchestrator for sync logic.
	 * @param logger The centralized logger.
	 * @param vscodeAdapter An adapter for interacting with the VS Code API.
	 */
	constructor(
		context: vscode.ExtensionContext,
		stateManager: SettingsService,
		syncManager: SyncManager,
		logger: Logger,
		vscodeAdapter: IVScodeAdapter,
	) {
		this.extensionUri = context.extensionUri;
		this.stateManager = stateManager;
		this.syncManager = syncManager;
		this.logger = logger;
		this.vscodeAdapter = vscodeAdapter;
	}

	/**
	 * Called by VS Code to resolve and render the webview view.
	 * This method sets up the webview's HTML, options, and message listeners.
	 *
	 * @param webviewView The webview view to be rendered.
	 */
	resolveWebviewView(webviewView: vscode.WebviewView) {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'src', 'view', 'control-panel', 'webview')],
		};

		webviewView.webview.html = getWebviewHtml(webviewView.webview, this.extensionUri);
		this.updateWebview();

		webviewView.webview.onDidReceiveMessage(
			async (message: Message) => {
				await this.handleMessage(message);
			},
			null,
			this.disposables,
		);

		vscode.workspace.onDidChangeConfiguration(
			e => {
				if (e.affectsConfiguration('fileHarmony')) {
					this.logger.info('Detected settings.json change, refreshing UI.');
					this.updateWebview();
				}
			},
			null,
			this.disposables,
		);
	}

	/**
	 * Posts a message to the webview to update its UI with a specific state.
	 *
	 * @param state The `WorkspaceState` object to send to the webview.
	 */
	public updateWebviewWithState(state: WorkspaceState) {
		this.notifyWebviewToUpdate(state);
	}

	/**
	 * Fetches the current state from the `SettingsService` and posts it to the webview.
	 * This is a convenience method to trigger a full UI refresh.
	 */
	public updateWebview() {
		const currState = this.stateManager.getState();
		this.notifyWebviewToUpdate(currState);
	}

	/**
	 * Sends a state update message to the webview.
	 *
	 * @private
	 * @param newState The new state to be rendered by the webview UI.
	 */
	private notifyWebviewToUpdate(newState: WorkspaceState) {
		this._view?.webview.postMessage({ command: WEBVIEW_MESSAGES_TO.UPDATE_WEBVIEW, value: newState });
	}

	/**
	 * The central message handler for all incoming messages from the webview.
	 * It delegates tasks based on the `command` property of the message.
	 *
	 * @private
	 * @param message The message received from the webview.
	 */
	private async handleMessage(message: Message) {
		this.logger.info(`Webview message received: ${message.command}`);

		switch (message.command) {
			case WEBVIEW_MESSAGES_FROM.GET_STATE:
				return this.handleGetState();

			case WEBVIEW_MESSAGES_FROM.UPDATE_STATE:
				return this.handleUpdateState(message);

			case WEBVIEW_MESSAGES_FROM.SELECT_FOLDER:
				return this.handleSelectFolder(message);

			case WEBVIEW_MESSAGES_FROM.SYNC_NOW:
				return this.handleSyncNow();

			case WEBVIEW_MESSAGES_FROM.SHOW_LOG_VIEWER:
				return this.handleShowLogViewer();

			case WEBVIEW_MESSAGES_FROM.PREVIEW_CHANGES:
				return this.handlePreviewChanges();

			case WEBVIEW_MESSAGES_FROM.RESET_STATE:
				return this.handleResetState();
		}
	}

	/**
	 * Handles the 'GET_STATE' message from the webview by sending back the current state.
	 * @private
	 */
	private handleGetState() {
		const newState = this.stateManager.getState();
		this.notifyWebviewToUpdate(newState);
	}

	/**
	 * Handles the 'UPDATE_STATE' message from the webview when the user clicks "Save".
	 * It validates the incoming state and persists it using the `SettingsService`.
	 *
	 * @private
	 * @param message The message containing the new state.
	 */
	private async handleUpdateState(message: UpdateStateMessage) {
		if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
			this.logger.showError('Cannot save settings. Please open a folder or workspace first.');
			return;
		}

		if (message.value.syncStatus) {
			if (!message.value.sourcePath || !message.value.targetPath) {
				this.logger.showError('Source Path or Target Path cannot be empty when sync is active!');
				return;
			}

			if (message.value.sourcePath === message.value.targetPath) {
				this.logger.showError('Source Path and Target Path cannot be the same!');
				return;
			}

			if (!fs.existsSync(message.value.sourcePath)) {
				this.logger.showError('Source directory does not exist! Sync cannot be activated.');
				return;
			}
		}

		const { syncStatus, ...configValues } = message.value;
		await this.stateManager.updateConfigurationState(configValues);
		await this.stateManager.updateEphemeralState({ syncStatus });
		await this.updateWatchers(syncStatus);
		this.logger.showInfo('Configuration Saved!');
	}

	/**
	 * Handles the 'SELECT_FOLDER' message from the webview to open a folder selection dialog.
	 *
	 * @private
	 * @param message The message indicating whether the source or target path is being selected.
	 */
	private async handleSelectFolder(message: SelectFolderMessage) {
		const options: vscode.OpenDialogOptions = {
			canSelectFolders: true,
			canSelectFiles: false,
			canSelectMany: false,
			openLabel: 'Select Folder',
		};

		const result = await this.vscodeAdapter.showOpenDialog(options);

		if (result && result.length > 0) {
			const selectedPath = result[0].fsPath;

			this._view?.webview.postMessage({
				command: WEBVIEW_MESSAGES_TO.FOLDER_SELECTED,
				payload: { for: message.payload.for, path: selectedPath },
			});
		}
	}

	/**
	 * Handles the 'SYNC_NOW' message from the webview by executing the corresponding command.
	 * @private
	 */
	private handleSyncNow() {
		this.logger.info('Manual sync requested by user.');
		vscode.commands.executeCommand(COMMAND_IDS.SYNC_NOW);
	}

	/**
	 * Handles the 'SHOW_LOG_VIEWER' message from the webview by executing the corresponding command.
	 * @private
	 */
	private handleShowLogViewer() {
		vscode.commands.executeCommand(COMMAND_IDS.SHOW_LOG_VIEWER);
	}

	/**
	 * Handles the 'PREVIEW_CHANGES' message from the webview. It calculates the sync preview
	 * and displays the results in the `PreviewPanelManager`.
	 * @private
	 */
	private async handlePreviewChanges() {
		this.logger.info('Preview requested by user.');

		try {
			const changes = await this.syncManager.calculatePreview();
			PreviewPanelManager.createOrShow(this.extensionUri, changes);
		} catch (err) {
			if (err instanceof NoWorkspaceOpenError) {
				this.logger.showError('Please open a folder before running a preview.');
			} else {
				this.logger.error('Failed to calculate preview.', err);
			}
		}
	}

	/**
	 * Handles the 'RESET_STATE' message from the webview. It prompts the user for confirmation
	 * before resetting the workspace's configuration to the defaults.
	 * @private
	 */
	private async handleResetState() {
		if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
			this.logger.showError('Cannot reset settings. Please open a folder or workspace first.');
			return;
		}

		const selection = await this.vscodeAdapter.showWarningMessage(
			'Are you sure you want to reset all settings for this workspace to their defaults?',
			true,
			'Reset Settings',
		);

		if (selection === 'Reset Settings') {
			this.logger.info('User confirmed settings reset.');
			await this.stateManager.resetConfiguration();
			this.logger.showInfo('Settings have been reset to default.');
		} else {
			this.logger.info('User canceled settings reset.');
		}
	}

	/**
	 * Updates the file watcher status based on the provided `syncStatus`.
	 * Starts the watcher if `true`, stops it if `false`.
	 *
	 * @private
	 * @param syncStatus The desired status of the watcher.
	 */
	private async updateWatchers(syncStatus: boolean) {
		if (syncStatus) {
			await this.syncManager.addSyncWatcher();
		} else {
			await this.syncManager.dispose();
		}
	}

	/**
	 * Disposes of the provider's resources when the view is closed.
	 */
	dispose() {
		for (const disposable of this.disposables) {
			disposable.dispose();
		}

		this.disposables = [];
		this._view = undefined;
	}
}

export default ControlPanelViewProvider;
