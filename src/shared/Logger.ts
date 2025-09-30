import * as vscode from 'vscode';
import type { IVScodeAdapter } from './vscode-adapter';

/**
 * A centralized logging service.
 * It writes to a dedicated VS Code Output Channel and can forward logs
 * to a UI callback for display in webviews. It also handles showing
 * user-facing notifications.
 */
export class Logger {
	private readonly _outputChannel: vscode.OutputChannel;
	private _uiLogCallback: ((message: string) => void) | undefined;
	private vscodeAdapter: IVScodeAdapter;

	/**
	 * Creates an instance of the Logger.
	 * @param channelName The name that will appear for the Output Channel in VS Code.
	 * @param vscodeAdapter An adapter for interacting with the VS Code API.
	 */
	constructor(channelName: string, vscodeAdapter: IVScodeAdapter) {
		this._outputChannel = vscode.window.createOutputChannel(channelName);
		this.vscodeAdapter = vscodeAdapter;
	}

	/**
	 * Registers a callback function to receive log messages.
	 * This is used to display logs in UI components like the Log Viewer.
	 * @param callback The function to call with each log message.
	 */
	public setUiLogCallback(callback: (message: string) => void) {
		this._uiLogCallback = callback;
	}

	/**
	 * The core logging method. Formats the message with a level and timestamp,
	 * writes it to the output channel, and calls the UI callback if registered.
	 * @private
	 * @param level The severity level of the log ('INFO', 'WARN', 'ERROR').
	 * @param message The raw log message.
	 */
	private log(level: 'INFO' | 'WARN' | 'ERROR', message: string) {
		const timestamp = new Date().toLocaleTimeString();
		const logMessage = `[${level} - ${timestamp}] ${message}`;
		this._outputChannel.appendLine(logMessage);

		if (this._uiLogCallback) {
			this._uiLogCallback(logMessage);
		}
	}

	/**
	 * Logs an informational message.
	 * @param message The message to log.
	 */
	public info(message: string) {
		this.log('INFO', message);
	}

	/**
	 * Logs a warning message.
	 * @param message The message to log.
	 */
	public warn(message: string) {
		this.log('WARN', message);
	}

	/**
	 * Logs an error message, optionally including details from an error object.
	 * @param message The primary error message.
	 * @param [error] The optional error object or unknown value for more details.
	 */
	public error(message: string, error?: unknown) {
		let errorMessage = message;
		if (error) {
			const errorDetails = error instanceof Error ? error.stack || error.message : JSON.stringify(error);
			errorMessage += `\nDetails: ${errorDetails}`;
		}
		this.log('ERROR', errorMessage);
	}

	/**
	 * Logs an informational message and shows a non-intrusive notification to the user.
	 * @param message The message to log and show.
	 */
	public showInfo(message: string) {
		this.info(message);
		this.vscodeAdapter.showInformationMessage(`File Harmony: ${message}`);
	}

	/**
	 * Logs a warning message and shows a warning notification to the user.
	 * @param message The message to log and show.
	 */
	public showWarning(message: string) {
		this.warn(message);
		this.vscodeAdapter.showWarningMessage(`File Harmony: ${message}`, false);
	}

	/**
	 * Logs an error message and shows an error notification to the user.
	 * @param message The message to log and show.
	 * @param [error] Optional error details to include in the output channel log.
	 */
	public showError(message: string, error?: unknown) {
		this.error(message, error);
		this.vscodeAdapter.showErrorMessage(`File Harmony: ${message}`);
	}

	/**
	 * Disposes of the logger's resources, specifically the output channel.
	 * Should be called when the extension is deactivated.
	 */
	public dispose() {
		this._outputChannel.dispose();
	}
}
