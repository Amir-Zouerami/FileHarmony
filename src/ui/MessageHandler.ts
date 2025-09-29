import type { Message, SelectFolderMessage, UpdateStateMessage } from '../types/Message';
import type WorkspaceStateManager from '../services/WorkspaceStateManager';
import type { WorkspaceState } from '../types/WorkspaceState';
import type SyncManager from '../services/SyncManager';
import type { Logger } from '../logger/Logger';
import * as vscode from 'vscode';
import fs from 'node:fs';

class MessageHandler {
	private stateManager: WorkspaceStateManager;
	private syncManager: SyncManager;
	private logger: Logger;

	constructor(stateManager: WorkspaceStateManager, syncManager: SyncManager, logger: Logger) {
		this.stateManager = stateManager;
		this.syncManager = syncManager;
		this.logger = logger;
	}

	async invokeMatchingMessageHandler(message: Message, view: vscode.WebviewView | undefined) {
		switch (message.command) {
			case 'GET_STATE': {
				const newState = this.getStateMessageHander();
				this.notifyWebViewToUpdate(newState, view);
				break;
			}
			case 'UPDATE_STATE': {
				if (!this.stopOnEmptySourceOrTarget(message)) return;

				this.updateStateMessageHandler(message);
				await this.updateWatchers(message.value.syncStatus);

				this.logger.showInfo('Configuration Updated!');
				break;
			}
			case 'SELECT_FOLDER': {
				await this.selectFolderMessageHandler(message, view);
				break;
			}
			case 'SYNC_NOW': {
				this.logger.info('Manual sync requested by user.');
				// We execute a command to show the status bar, keeping this class clean.
				vscode.commands.executeCommand('fileHarmony.syncNowWithFeedback');
				break;
			}
			case 'SHOW_LOG_VIEWER': {
				vscode.commands.executeCommand('fileHarmony.showLogViewer');
				break;
			}
		}
	}

	notifyWebViewToUpdate(newState: WorkspaceState, view: vscode.WebviewView | undefined) {
		view?.webview.postMessage({ command: 'UPDATE_WEBVIEW', value: newState });
	}

	private async selectFolderMessageHandler(message: SelectFolderMessage, view: vscode.WebviewView | undefined) {
		const options: vscode.OpenDialogOptions = {
			canSelectFolders: true,
			canSelectFiles: false,
			canSelectMany: false,
			openLabel: 'Select Folder',
		};

		const result = await vscode.window.showOpenDialog(options);
		if (result && result.length > 0) {
			const selectedPath = result[0].fsPath;

			view?.webview.postMessage({
				command: 'FOLDER_SELECTED',
				payload: {
					for: message.payload.for,
					path: selectedPath,
				},
			});
		}
	}

	private updateStateMessageHandler(message: UpdateStateMessage) {
		this.stateManager.updateState(message.value);
	}

	private getStateMessageHander() {
		return this.stateManager.getState();
	}

	private stopOnEmptySourceOrTarget(message: UpdateStateMessage): boolean {
		if (message.value.syncStatus) {
			if (!message.value.sourcePath || !message.value.targetPath) {
				this.logger.showError('Source Path or Target Path cannot be empty! Saving config failed!');
				return false;
			}

			if (message.value.sourcePath === message.value.targetPath) {
				this.logger.showError('Source Path and Target Path cannot be equal!');
				return false;
			}

			if (!fs.existsSync(message.value.sourcePath)) {
				this.logger.showError('Source directory does not exist! Saving config failed!');
				return false;
			}
		}

		return true;
	}

	private async updateWatchers(syncStatus: boolean) {
		if (syncStatus) {
			await this.syncManager.addSyncWatcher();
		} else {
			await this.syncManager.dispose();
		}
	}
}

export default MessageHandler;
