import { VIEW_IDS, type WEBVIEW_MESSAGES_TO } from '../../shared/constants';
import * as vscode from 'vscode';
import fs from 'node:fs';

interface LogMessage {
	command: typeof WEBVIEW_MESSAGES_TO.LOG;
	level: 'INFO' | 'WARN' | 'ERROR';
	message: string;
}

/**
 * Manages the lifecycle of the Log Viewer webview panel.
 * This class follows a singleton pattern to ensure that only one Log Viewer panel
 * exists at a time. It handles panel creation, message passing, and disposal.
 */
export class LogViewerPanelManager {
	private static _instance: LogViewerPanelManager | undefined;
	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];

	/**
	 * Private constructor to enforce the singleton pattern.
	 *
	 * @private
	 * @param extensionUri The URI of the extension's root directory, used for loading local resources.
	 */
	private constructor(extensionUri: vscode.Uri) {
		this._extensionUri = extensionUri;
		const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

		this._panel = vscode.window.createWebviewPanel(
			VIEW_IDS.LOG_VIEWER_PANEL,
			'File Harmony Log',
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'src', 'view', 'log-viewer', 'webview')],
			},
		);

		this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
		this._panel.iconPath = vscode.Uri.joinPath(this._extensionUri, 'resources', 'FH.svg');
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
	}

	/**
	 * Creates the Log Viewer panel if it doesn't exist, or reveals it if it already does.
	 *
	 * @param extensionUri The URI of the extension's root directory.
	 */
	public static createOrShow(extensionUri: vscode.Uri) {
		if (LogViewerPanelManager._instance) {
			LogViewerPanelManager._instance._panel.reveal(vscode.window.activeTextEditor?.viewColumn);
		} else {
			LogViewerPanelManager._instance = new LogViewerPanelManager(extensionUri);
		}
	}

	/**
	 * Posts a log message to the webview to be displayed in the UI.
	 * @param message The log message object to send.
	 */
	public static postMessage(message: LogMessage) {
		LogViewerPanelManager._instance?._panel.webview.postMessage(message);
	}

	/**
	 * Disposes of the current Log Viewer panel instance.
	 */
	public static dispose() {
		LogViewerPanelManager._instance?.dispose();
	}

	/**
	 * The instance-level disposal method that cleans up the panel and its disposables.
	 * @private
	 */
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

	/**
	 * Generates the complete HTML content for the webview.
	 * It reads an HTML template file and injects the correct URIs for styles, scripts,
	 * and the Content Security Policy source.
	 *
	 * @private
	 * @param webview The webview instance to generate HTML for.
	 * @returns The complete HTML string.
	 */
	private _getHtmlForWebview(webview: vscode.Webview): string {
		const webviewPath = vscode.Uri.joinPath(this._extensionUri, 'src', 'view', 'log-viewer', 'webview');
		const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewPath, 'log-viewer.css'));
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewPath, 'log-viewer.js'));
		const htmlPath = vscode.Uri.joinPath(webviewPath, 'log-viewer.html');

		let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf-8');

		htmlContent = htmlContent
			.replace(/#{stylesUri}/g, stylesUri.toString())
			.replace(/#{scriptUri}/g, scriptUri.toString())
			.replace(/#{cspSource}/g, webview.cspSource);

		return htmlContent;
	}
}
