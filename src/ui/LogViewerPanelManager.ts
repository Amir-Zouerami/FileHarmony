import * as vscode from 'vscode';
import fs from 'node:fs';

interface LogMessage {
	command: 'log';
	level: 'INFO' | 'WARN' | 'ERROR';
	message: string;
}

export class LogViewerPanelManager {
	private static _instance: LogViewerPanelManager | undefined;
	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];

	private constructor(extensionUri: vscode.Uri) {
		this._extensionUri = extensionUri;
		const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

		this._panel = vscode.window.createWebviewPanel(
			'fileHarmonyLog',
			'File Harmony Log',
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'src', 'ui', 'log-viewer')],
			},
		);

		this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
		this._panel.iconPath = vscode.Uri.joinPath(this._extensionUri, 'resources', 'FH.svg');
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
	}

	public static createOrShow(extensionUri: vscode.Uri) {
		if (LogViewerPanelManager._instance) {
			LogViewerPanelManager._instance._panel.reveal(vscode.window.activeTextEditor?.viewColumn);
		} else {
			LogViewerPanelManager._instance = new LogViewerPanelManager(extensionUri);
		}
	}

	public static postMessage(message: LogMessage) {
		LogViewerPanelManager._instance?._panel.webview.postMessage(message);
	}

	public static dispose() {
		LogViewerPanelManager._instance?.dispose();
	}

	private dispose() {
		LogViewerPanelManager._instance = undefined;
		this._panel.dispose();

		while (this._disposables.length) {
			const x = this._disposables.pop();

			if (x) {
				x.dispose();
			}
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview): string {
		const viewerPath = vscode.Uri.joinPath(this._extensionUri, 'src', 'ui', 'log-viewer');
		const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(viewerPath, 'log-viewer.css'));
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(viewerPath, 'log-viewer.js'));
		const htmlPath = vscode.Uri.joinPath(viewerPath, 'log-viewer.html');

		let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf-8');

		htmlContent = htmlContent
			.replace(/#{stylesUri}/g, stylesUri.toString())
			.replace(/#{scriptUri}/g, scriptUri.toString())
			.replace(/#{cspSource}/g, webview.cspSource);

		return htmlContent;
	}
}
