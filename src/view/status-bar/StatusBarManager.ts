import { COMMAND_IDS } from '../../shared/constants';
import * as vscode from 'vscode';

/** Represents the possible states of the synchronization process for the status bar. */
export type SyncStatus = 'active' | 'inactive' | 'syncing' | 'error';

/**
 * Manages the extension's `StatusBarItem`.
 * This class handles creating, showing, and updating the status bar entry
 * to reflect the current synchronization state (e.g., active, inactive, syncing, error).
 */
export class StatusBarManager {
	private readonly _statusBarItem: vscode.StatusBarItem;
	private _isInErrorState = false;

	/**
	 * Creates an instance of StatusBarManager.
	 * Initializes the `StatusBarItem`, sets its initial state, and shows it in the UI.
	 */
	constructor() {
		this._statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
		this.update('inactive');
		this._statusBarItem.show();
	}

	/**
	 * Updates the appearance and behavior of the status bar item based on the given sync status.
	 * It handles text, icons, tooltips, and associated commands. It also manages the persistent error state.
	 *
	 * @param status The new status to reflect in the UI.
	 * @param [details] Optional additional information to display in the tooltip, typically for errors.
	 */
	public update(status: SyncStatus, details?: string) {
		if (status === 'error') {
			this._isInErrorState = true;
			this._statusBarItem.text = '$(error) File Harmony';
			this._statusBarItem.tooltip = `An error occurred. Click to clear. ${
				details ? `Details: ${details}` : 'Check the output log.'
			}`;

			this._statusBarItem.command = COMMAND_IDS.CLEAR_ERROR_STATE;
			return;
		}

		if (this._isInErrorState) {
			return;
		}

		switch (status) {
			case 'active':
				this._statusBarItem.text = '$(check) File Harmony';
				this._statusBarItem.tooltip = 'Sync is active and watching for changes.';
				this._statusBarItem.command = COMMAND_IDS.TOGGLE_SYNC_STATUS;
				break;

			case 'inactive':
				this._statusBarItem.text = '$(circle-slash) File Harmony';
				this._statusBarItem.tooltip = 'Sync is inactive. Click to toggle.';
				this._statusBarItem.command = COMMAND_IDS.TOGGLE_SYNC_STATUS;
				break;

			case 'syncing':
				this._statusBarItem.text = '$(sync~spin) File Harmony';
				this._statusBarItem.tooltip = 'Sync in progress...';
				this._statusBarItem.command = undefined;
				break;
		}
	}

	/**
	 * Clears a persistent error state from the status bar and sets it to a new, non-error status.
	 * This is typically called when the user acknowledges an error by clicking the status bar item.
	 *
	 * @param newStatus The status to apply after clearing the error.
	 */
	public clearErrorStateAndSet(newStatus: SyncStatus) {
		this._isInErrorState = false;
		this.update(newStatus);
	}

	/**
	 * Disposes of the status bar item, removing it from the UI.
	 * Should be called on extension deactivation.
	 */
	public dispose() {
		this._statusBarItem.dispose();
	}
}
