import { VIEW_IDS, WEBVIEW_MESSAGES_FROM, WEBVIEW_MESSAGES_TO } from '../../shared/constants';
import type { ChangeLog } from '../../shared/types';
import * as vscode from 'vscode';
import fs from 'node:fs';

/**
 * Manages the lifecycle of the Sync Preview webview panel.
 * This class follows a singleton pattern to ensure only one Preview panel exists
 * at a time. It handles creation, data population, and interaction (like diff viewing).
 */
export class PreviewPanelManager {
	private static _instance: PreviewPanelManager | undefined;
	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];

	/**
	 * Private constructor to enforce the singleton pattern.
	 *
	 * @private
	 * @param extensionUri The URI of the extension's root directory.
	 * @param changes The initial list of changes to display in the preview.
	 */
	private constructor(extensionUri: vscode.Uri, changes: ChangeLog[]) {
		this._extensionUri = extensionUri;
		const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

		this._panel = vscode.window.createWebviewPanel(
			VIEW_IDS.PREVIEW_PANEL,
			'Sync Preview',
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [
					vscode.Uri.joinPath(this._extensionUri, 'src', 'view', 'preview-panel', 'webview'),
				],
			},
		);

		this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
		this._panel.iconPath = vscode.Uri.joinPath(this._extensionUri, 'resources', 'FH.svg');
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		this._panel.webview.onDidReceiveMessage(
			message => {
				if (message.command === WEBVIEW_MESSAGES_FROM.VIEW_DIFF) {
					const sourceUri = vscode.Uri.file(message.sourcePath);
					const targetUri = vscode.Uri.file(message.targetPath);

					vscode.commands.executeCommand(
						'vscode.diff',
						sourceUri,
						targetUri,
						`${message.relativePath} (Source ↔ Target)`,
					);
				}
			},
			null,
			this._disposables,
		);

		this._panel.webview.postMessage({ command: WEBVIEW_MESSAGES_TO.SHOW_CHANGES, changes });
	}

	/**
	 * Creates the Preview panel if it doesn't exist, or reveals and updates it if it does.
	 *
	 * @param extensionUri The URI of the extension's root directory.
	 * @param changes The list of changes to display.
	 */
	public static createOrShow(extensionUri: vscode.Uri, changes: ChangeLog[]) {
		if (PreviewPanelManager._instance) {
			PreviewPanelManager._instance._panel.reveal(vscode.window.activeTextEditor?.viewColumn);
			PreviewPanelManager._instance._panel.webview.postMessage({
				command: WEBVIEW_MESSAGES_TO.SHOW_CHANGES,
				changes,
			});
		} else {
			PreviewPanelManager._instance = new PreviewPanelManager(extensionUri, changes);
		}
	}

	/**
	 * Disposes of the current Preview panel instance.
	 */
	public static dispose() {
		PreviewPanelManager._instance?.dispose();
	}

	/**
	 * The instance-level disposal method that cleans up the panel and its disposables.
	 * @private
	 */
	private dispose() {
		PreviewPanelManager._instance = undefined;
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
	 *
	 * @private
	 * @param webview The webview instance to generate HTML for.
	 * @returns The complete HTML string.
	 */
	private _getHtmlForWebview(webview: vscode.Webview): string {
		const webviewPath = vscode.Uri.joinPath(this._extensionUri, 'src', 'view', 'preview-panel', 'webview');
		const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewPath, 'preview.css'));
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewPath, 'preview.js'));
		const htmlPath = vscode.Uri.joinPath(webviewPath, 'preview.html');

		let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf-8');

		htmlContent = htmlContent
			.replace(/#{stylesUri}/g, stylesUri.toString())
			.replace(/#{scriptUri}/g, scriptUri.toString())
			.replace(/#{cspSource}/g, webview.cspSource);

		return htmlContent;
	}
}
