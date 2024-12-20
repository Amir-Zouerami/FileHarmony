import WorkspaceStateManager from '../stateManager/WorkspaceStateManager';
import MessageHandler from './MessageHandler';
import { Message } from '../types/Message';
import * as vscode from 'vscode';
import path from 'node:path';
import fs from 'node:fs';

class FileHarmonyViewProvider implements vscode.WebviewViewProvider {
	private disposables: vscode.Disposable[] = [];
	private stateManager: WorkspaceStateManager;
	private messageHandler: MessageHandler;
	private _view?: vscode.WebviewView;
	private initialHTML: string;

	constructor(context: vscode.ExtensionContext, messageHandler: MessageHandler, stateManager: WorkspaceStateManager) {
		this.stateManager = stateManager;
		this.messageHandler = messageHandler;
		this.initialHTML = fs.readFileSync(path.join(context.extensionPath, 'src', 'pages', 'control-panel.html'), 'utf-8');
	}

	resolveWebviewView(webviewView: vscode.WebviewView) {
		this._view = webviewView;
		webviewView.webview.options = { enableScripts: true };
		webviewView.webview.html = this.getHtmlForWebview();
		this.updateWebview();

		this.disposables.push(
			webviewView.webview.onDidReceiveMessage(async (message: Message) => {
				await this.messageHandler.invokeMatchingMessageHandler(message, this._view);
			}),

			// webviewView.onDidChangeVisibility(() => {
			// 	this.updateWebview();
			// }),
		);
	}

	updateWebview() {
		if (this._view) {
			const currState = this.stateManager.getState();
			this.messageHandler.notifyWebViewToUpdate(currState, this._view);
		}
	}

	private getHtmlForWebview() {
		return this.initialHTML;
	}

	dispose() {
		this.disposables.forEach(disposable => disposable.dispose());
		this.disposables = [];
		this._view = undefined;
	}
}

export default FileHarmonyViewProvider;
