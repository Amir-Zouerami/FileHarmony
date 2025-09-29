import type WorkspaceStateManager from '../services/WorkspaceStateManager';
import type MessageHandler from './MessageHandler';
import type { Message } from '../types/Message';
import * as vscode from 'vscode';
import fs from 'node:fs';

class FileHarmonyViewProvider implements vscode.WebviewViewProvider {
	private disposables: vscode.Disposable[] = [];
	private stateManager: WorkspaceStateManager;
	private messageHandler: MessageHandler;
	private _view?: vscode.WebviewView;
	private readonly extensionUri: vscode.Uri;

	constructor(context: vscode.ExtensionContext, messageHandler: MessageHandler, stateManager: WorkspaceStateManager) {
		this.stateManager = stateManager;
		this.messageHandler = messageHandler;
		this.extensionUri = context.extensionUri;
	}

	resolveWebviewView(webviewView: vscode.WebviewView) {
		this._view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'src', 'ui')],
		};

		webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
		this.updateWebview();

		this.disposables.push(
			webviewView.webview.onDidReceiveMessage(async (message: Message) => {
				await this.messageHandler.invokeMatchingMessageHandler(message, this._view);
			}),
		);
	}

	updateWebview() {
		if (this._view) {
			const currState = this.stateManager.getState();
			this.messageHandler.notifyWebViewToUpdate(currState, this._view);
		}
	}

	private getHtmlForWebview(webview: vscode.Webview): string {
		const pagesPath = vscode.Uri.joinPath(this.extensionUri, 'src', 'ui', 'pages');

		const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(pagesPath, 'control-panel.css'));
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(pagesPath, 'control-panel.js'));

		const htmlPath = vscode.Uri.joinPath(pagesPath, 'control-panel.html');
		const htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf-8');

		return htmlContent
			.replace(/#{stylesUri}/g, stylesUri.toString())
			.replace(/#{scriptUri}/g, scriptUri.toString())
			.replace(/#{cspSource}/g, webview.cspSource);
	}

	dispose() {
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
		this.disposables = [];
		this._view = undefined;
	}
}

export default FileHarmonyViewProvider;
