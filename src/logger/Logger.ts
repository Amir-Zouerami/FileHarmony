import * as vscode from 'vscode';

export class Logger {
	private readonly _outputChannel: vscode.OutputChannel;

	constructor(channelName: string) {
		this._outputChannel = vscode.window.createOutputChannel(channelName);
	}

	private log(level: 'INFO' | 'WARN' | 'ERROR', message: string) {
		const timestamp = new Date().toLocaleTimeString();
		this._outputChannel.appendLine(`[${level} - ${timestamp}] ${message}`);
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

	public showToast(message: string) {
		this.info(message);

		vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: `File Harmony: ${message}`,
				cancellable: false,
			},
			async _progress => {
				await new Promise(resolve => setTimeout(resolve, 2000));
			},
		);
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
