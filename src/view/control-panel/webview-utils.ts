import * as vscode from 'vscode';
import * as fs from 'node:fs';

/**
 * Generates the complete HTML content for the Control Panel webview.
 * It reads an HTML template file and dynamically injects the correct URIs for styles and scripts,
 * as well as the Content Security Policy (CSP) source to allow the webview to load them.
 *
 * @param webview The webview instance for which to generate the HTML.
 * @param extensionUri The URI of the extension's root directory.
 * @returns The complete, ready-to-use HTML string for the webview.
 */
export function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	const webviewPath = vscode.Uri.joinPath(extensionUri, 'src', 'view', 'control-panel', 'webview');

	const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewPath, 'control-panel.css'));
	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewPath, 'control-panel.js'));
	const htmlPath = vscode.Uri.joinPath(webviewPath, 'control-panel.html');

	const htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf-8');

	return htmlContent
		.replace(/#{stylesUri}/g, stylesUri.toString())
		.replace(/#{scriptUri}/g, scriptUri.toString())
		.replace(/#{cspSource}/g, webview.cspSource);
}
