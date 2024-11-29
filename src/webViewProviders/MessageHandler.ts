import WorkspaceStateManager from '../stateManager/WorkspaceStateManager';
import { Message, UpdateStateMessage } from '../types/Message';
import { showErrorMessage, showInfoMessage } from '../utils';
import { WorkspaceState } from '../types/WorkspaceState';
import SyncManager from '../SyncManager';
import * as vscode from 'vscode';
import fs from 'node:fs';

class MessageHandler {
	private stateManager: WorkspaceStateManager;
	private syncManager: SyncManager;

	constructor(stateManager: WorkspaceStateManager, syncManager: SyncManager) {
		this.stateManager = stateManager;
		this.syncManager = syncManager;
	}

	async invokeMatchingMessageHandler(message: Message, view: vscode.WebviewView | undefined) {
		if (message.command === 'UPDATE_STATE') {
			this.stopOnEmptySourceOrTarget(message);

			this.updateStateMessageHandler(message);
			await this.updateWatchers(message.value.syncStatus);

			showInfoMessage('File Harmony: Configuration Updated!');
		} else {
			// It's a GET_STATE request from the webview
			const newState = this.getStateMessageHander();
			this.notifyWebViewToUpdate(newState, view);
		}
	}

	notifyWebViewToUpdate(newState: WorkspaceState, view: vscode.WebviewView | undefined) {
		view?.webview.postMessage({ command: 'UPDATE_WEBVIEW', value: newState });
	}

	private updateStateMessageHandler(message: UpdateStateMessage) {
		this.stateManager.updateState(message.value);
	}

	private getStateMessageHander() {
		return this.stateManager.getState();
	}

	private stopOnEmptySourceOrTarget(message: UpdateStateMessage) {
		if (message.value.syncStatus) {
			if (!message.value.sourcePath || !message.value.targetPath) {
				throw showErrorMessage('File Harmony: Source Path or Target Path cannot be empty! Saving config failed!');
			}

			if (message.value.sourcePath === message.value.targetPath) {
				throw showErrorMessage('Source Path and Target Path cannot be equal!');
			}

			if (!fs.existsSync(message.value.sourcePath)) {
				throw showErrorMessage('Source directory does not exist! Saving config failed!');
			}
		}
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
