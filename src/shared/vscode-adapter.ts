import * as vscode from 'vscode';

/**
 * An interface that defines a contract for interacting with the VS Code API.
 * This abstraction allows for easy mocking in tests by decoupling core logic
 * from the static `vscode` namespace.
 */
export interface IVScodeAdapter {
	/**
	 * Shows a warning message to the user with optional action items.
	 * @param message The message to show.
	 * @param isModal If true, the message box will be modal, blocking other interactions.
	 * @param items A list of strings to show as action buttons in the message.
	 * @returns A promise that resolves to the selected action item string or undefined if dismissed.
	 */
	showWarningMessage(message: string, isModal: boolean, ...items: string[]): Promise<string | undefined>;

	/**
	 * Shows an informational message to the user.
	 * @param message The message to show.
	 */
	showInformationMessage(message: string): void;

	/**
	 * Shows an error message to the user.
	 * @param message The message to show.
	 */
	showErrorMessage(message: string): void;

	/**
	 * Opens the standard VS Code side-by-side diff view.
	 * @param sourceUri The URI of the file on the left side.
	 * @param targetUri The URI of the file on the right side.
	 * @param title A human-readable title for the diff editor tab.
	 */
	openDiff(sourceUri: vscode.Uri, targetUri: vscode.Uri, title: string): void;

	/**
	 * Shows the native file/folder open dialog.
	 * @param options Configuration options for the dialog.
	 * @returns A promise that resolves to an array of selected URIs or undefined if cancelled.
	 */
	showOpenDialog(options: vscode.OpenDialogOptions): Promise<vscode.Uri[] | undefined>;
}

/**
 * A concrete implementation of the IVScodeAdapter that interacts directly with the `vscode` namespace.
 * This class is the primary implementation used when the extension is running.
 */
export class VScodeAdapter implements IVScodeAdapter {
	/**
	 * {@inheritDoc IVScodeAdapter.showWarningMessage}
	 */
	public showWarningMessage(message: string, isModal: boolean, ...items: string[]): Promise<string | undefined> {
		return Promise.resolve(vscode.window.showWarningMessage(message, { modal: isModal }, ...items));
	}

	/**
	 * {@inheritDoc IVScodeAdapter.showInformationMessage}
	 */
	public showInformationMessage(message: string): void {
		vscode.window.showInformationMessage(message);
	}

	/**
	 * {@inheritDoc IVScodeAdapter.showErrorMessage}
	 */
	public showErrorMessage(message: string): void {
		vscode.window.showErrorMessage(message);
	}

	/**
	 * {@inheritDoc IVScodeAdapter.openDiff}
	 */
	public openDiff(sourceUri: vscode.Uri, targetUri: vscode.Uri, title: string): void {
		vscode.commands.executeCommand('vscode.diff', sourceUri, targetUri, title);
	}

	/**
	 * {@inheritDoc IVScodeAdapter.showOpenDialog}
	 */
	public showOpenDialog(options: vscode.OpenDialogOptions): Promise<vscode.Uri[] | undefined> {
		return Promise.resolve(vscode.window.showOpenDialog(options));
	}
}
