import * as vscode from 'vscode';

export class Logger {
	private readonly _outputChannel: vscode.OutputChannel;
	private _uiLogCallback: ((message: string) => void) | undefined;

	constructor(channelName: string) {
		this._outputChannel = vscode.window.createOutputChannel(channelName);
	}

	public setUiLogCallback(callback: (message: string) => void) {
		this._uiLogCallback = callback;
	}

	private log(level: 'INFO' | 'WARN' | 'ERROR', message: string) {
		const timestamp = new Date().toLocaleTimeString();
		const logMessage = `[${level} - ${timestamp}] ${message}`;
		this._outputChannel.appendLine(logMessage);

		if (this._uiLogCallback) {
			this._uiLogCallback(logMessage);
		}
	}

	public info(message: string) {
		this.log('INFO', message);
	}

	public warn(message: string) {
		this.log('WARN', message);
	}

	public error(message: string, error?: unknown) {
		let errorMessage = message;
		if (error) {
			const errorDetails = error instanceof Error ? error.stack || error.message : JSON.stringify(error);
			errorMessage += `\nDetails: ${errorDetails}`;
		}
		this.log('ERROR', errorMessage);
	}

	public showInfo(message: string) {
		this.info(message);
		vscode.window.showInformationMessage(`File Harmony: ${message}`);
	}

	public showWarning(message: string) {
		this.warn(message);
		vscode.window.showWarningMessage(`File Harmony: ${message}`);
	}

	public showError(message: string, error?: unknown) {
		this.error(message, error);
		vscode.window.showErrorMessage(`File Harmony: ${message}`);
	}

	public dispose() {
		this._outputChannel.dispose();
	}
}
