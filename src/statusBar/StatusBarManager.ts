import * as vscode from 'vscode';

export type SyncStatus = 'active' | 'inactive' | 'syncing' | 'error';

export class StatusBarManager {
	private readonly _statusBarItem: vscode.StatusBarItem;

	constructor() {
		this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
		this.update('inactive'); // initial state
		this._statusBarItem.show();
	}

	public update(status: SyncStatus, details?: string) {
		switch (status) {
			case 'active':
				this._statusBarItem.text = '$(check) File Harmony';
				this._statusBarItem.tooltip = 'Sync is active and watching for changes.';
				this._statusBarItem.command = 'fileHarmony.toggleSyncStatus';
				break;
			case 'inactive':
				this._statusBarItem.text = '$(circle-slash) File Harmony';
				this._statusBarItem.tooltip = 'Sync is inactive. Click to toggle.';
				this._statusBarItem.command = 'fileHarmony.toggleSyncStatus';
				break;
			case 'syncing':
				this._statusBarItem.text = '$(sync~spin) File Harmony';
				this._statusBarItem.tooltip = 'Sync in progress...';
				this._statusBarItem.command = undefined; // Not clickable during sync
				break;
			case 'error':
				this._statusBarItem.text = '$(error) File Harmony';
				this._statusBarItem.tooltip = `An error occurred. ${
					details ? `Details: ${details}` : 'Check the output log.'
				}`;
				this._statusBarItem.command = 'fileHarmony.getWatchStatus';
				break;
		}
	}

	public dispose() {
		this._statusBarItem.dispose();
	}
}
