import * as vscode from 'vscode';

export const informStatus = (currStatus: boolean) => {
	const watcherActiveMessage = 'File Harmony: Watch Status Active!';
	const watcherInactiveMessage = 'File Harmony: Watch Status Inactive!';

	currStatus ? showInfoMessage(watcherActiveMessage) : showWarningMessage(watcherInactiveMessage);
};

export const showInfoMessage = (message: string) => {
	vscode.window.showInformationMessage(message);
};

export const showWarningMessage = (warning: string) => {
	vscode.window.showWarningMessage(warning);
};

export const showErrorMessage = (error: string) => {
	vscode.window.showErrorMessage(error, { modal: false }, 'Dismiss');
};
