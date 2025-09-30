import type { StatusBarManager } from '../../view/status-bar/StatusBarManager';
import type { IVScodeAdapter } from '../../shared/vscode-adapter';
import type { WorkspaceState } from '../../shared/types';
import type { Logger } from '../../shared/Logger';
import * as vscode from 'vscode';

/**
 * A dedicated service for handling file conflicts during synchronization.
 * It encapsulates the logic for the four different conflict resolution strategies.
 */
export class ConflictHandler {
	private logger: Logger;
	private statusBarManager: StatusBarManager;
	private pendingConflicts: Set<string>;
	private vscodeAdapter: IVScodeAdapter;

	/**
	 * Creates an instance of ConflictHandler.
	 *
	 * @param logger The centralized logger.
	 * @param statusBarManager The manager for updating the status bar UI.
	 * @param pendingConflicts A set of file paths that are currently awaiting user input from an 'Ask' dialog.
	 * @param vscodeAdapter An adapter for showing user-facing dialogs and messages.
	 */
	constructor(
		logger: Logger,
		statusBarManager: StatusBarManager,
		pendingConflicts: Set<string>,
		vscodeAdapter: IVScodeAdapter,
	) {
		this.logger = logger;
		this.statusBarManager = statusBarManager;
		this.pendingConflicts = pendingConflicts;
		this.vscodeAdapter = vscodeAdapter;
	}

	/**
	 * Handles a detected conflict according to the user-configured resolution strategy.
	 *
	 * @param sourcePath The absolute path of the source file.
	 * @param targetPath The absolute path of the target file.
	 * @param relativePath The file path relative to the source root.
	 * @param conflictResolution The configured strategy ('Source Wins', 'Target Wins', etc.).
	 * @returns A promise that resolves to `true` if the file should be copied (i.e., source wins),
	 * and `false` if it should be skipped (i.e., target wins).
	 */
	public async handleConflict(
		sourcePath: string,
		targetPath: string,
		relativePath: string,
		conflictResolution: WorkspaceState['conflictResolution'],
	): Promise<boolean> {
		switch (conflictResolution) {
			case 'Source Wins':
				this.logger.warn(`CONFLICT: Overwriting newer file in target: ${relativePath} (Source Wins)`);
				return true;

			case 'Target Wins':
				this.logger.info(`Skipped sync for ${relativePath} (Target Wins)`);
				return false;

			case 'Log Error and Skip':
				this.logger.showError(`Skipped sync for ${relativePath}. Target version is newer.`);
				this.statusBarManager.update('error', `Conflict on: ${relativePath}`);
				return false;

			case 'Ask':
				return await this.handleAskConflict(sourcePath, targetPath, relativePath);
		}
	}

	/**
	 * Implements the 'Ask' conflict resolution strategy by showing a modal dialog to the user.
	 *
	 * @private
	 * @param sourcePath The absolute path of the source file.
	 * @param targetPath The absolute path of the target file.
	 * @param relativePath The file path relative to the source root.
	 * @returns A promise that resolves to `true` if the user chooses to overwrite, `false` otherwise.
	 */
	private async handleAskConflict(sourcePath: string, targetPath: string, relativePath: string): Promise<boolean> {
		this.pendingConflicts.add(sourcePath);

		try {
			const selection = await this.vscodeAdapter.showWarningMessage(
				`Conflict detected for "${relativePath}". The target file has been modified.`,
				true,
				'Overwrite Target (Source Wins)',
				'Skip (Target Wins)',
				'View Diff',
			);

			if (selection === 'Overwrite Target (Source Wins)') {
				this.logger.warn(`User chose to overwrite newer file in target: ${relativePath}`);
				return true;
			}

			if (selection === 'Skip (Target Wins)') {
				this.logger.info(`User chose to skip sync for ${relativePath}`);
				return false;
			}

			if (selection === 'View Diff') {
				this.vscodeAdapter.openDiff(
					vscode.Uri.file(sourcePath),
					vscode.Uri.file(targetPath),
					`${relativePath} (Source ↔ Target)`,
				);

				return false;
			}

			return false;
		} catch (error) {
			this.logger.error(`Error during conflict resolution for ${relativePath}`, error);
			return false;
		} finally {
			this.pendingConflicts.delete(sourcePath);
		}
	}
}
