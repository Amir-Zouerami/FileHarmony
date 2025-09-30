import type { WorkspaceState } from '../../shared/types';
import { CONFIG_SECTION } from '../../shared/constants';
import * as vscode from 'vscode';

// Keys for ephemeral state stored in workspaceState
const STATE_KEYS = {
	SYNC_STATUS: 'syncStatus',
	LAST_SYNCED: 'lastSynced',
};

// Key for the old state, used for one-time migration
const LEGACY_STATE_KEY = 'FILE_HARMONY';

/**
 * Manages all extension settings and state.
 * This service acts as a single source of truth for the application's configuration,
 * abstracting away the distinction between persistent settings (`settings.json`)
 * and ephemeral workspace state (`workspaceState`). It also handles one-time data migration.
 */
class SettingsService {
	private context: vscode.ExtensionContext;

	/**
	 * Creates an instance of the SettingsService.
	 *
	 * @param context The extension context provided by VS Code, used for accessing workspace state.
	 */
	constructor(context: vscode.ExtensionContext) {
		this.context = context;
	}

	/**
	 * Gets the complete, combined state from both VS Code settings and workspace state.
	 *
	 * @returns The full WorkspaceState object representing the current configuration.
	 */
	public getState(): WorkspaceState {
		const config = vscode.workspace.getConfiguration(CONFIG_SECTION);

		return {
			sourcePath: config.get<string>('sourcePath', ''),
			targetPath: config.get<string>('targetPath', ''),
			ignoreList: config.get<string[]>('ignoreList', []),
			syncMode: config.get<'smart' | 'force'>('syncMode', 'smart'),
			conflictResolution: config.get<'Source Wins' | 'Target Wins' | 'Log Error and Skip' | 'Ask'>(
				'conflictResolution',
				'Source Wins',
			),
			syncStatus: this.context.workspaceState.get<boolean>(STATE_KEYS.SYNC_STATUS, false),
			lastSynced: this.context.workspaceState.get<string | null>(STATE_KEYS.LAST_SYNCED, null),
		};
	}

	/**
	 * Updates a specific configuration setting in the workspace `settings.json` file.
	 *
	 * @private
	 * @param key The key of the setting to update.
	 * @param value The new value for the setting.
	 */
	private async updateConfiguration(key: keyof WorkspaceState, value: unknown): Promise<void> {
		const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
		await config.update(key, value, vscode.ConfigurationTarget.Workspace);
	}

	/**
	 * Updates the entire persistent configuration (in `settings.json`) based on a partial state object.
	 * This is typically called from the UI when the user saves changes.
	 * It intelligently ignores ephemeral state keys like `syncStatus`.
	 *
	 * @param newState A partial state object containing new configuration values.
	 */
	public async updateConfigurationState(newState: Partial<WorkspaceState>): Promise<void> {
		const updatePromises: Promise<void>[] = [];

		for (const key in newState) {
			if (Object.hasOwn(newState, key)) {
				const typedKey = key as keyof WorkspaceState;

				if (typedKey !== 'syncStatus' && typedKey !== 'lastSynced') {
					updatePromises.push(this.updateConfiguration(typedKey, newState[typedKey]));
				}
			}
		}
		await Promise.all(updatePromises);
	}

	/**
	 * Updates the ephemeral (non-settings.json) state, such as the sync status or last synced timestamp.
	 * This state is local to the workspace and not shared via source control.
	 * @param stateUpdate A partial state object containing only ephemeral keys to update.
	 */
	public async updateEphemeralState(
		stateUpdate: Partial<Pick<WorkspaceState, 'syncStatus' | 'lastSynced'>>,
	): Promise<void> {
		const updatePromises: Promise<void>[] = [];

		if (stateUpdate.syncStatus !== undefined) {
			updatePromises.push(
				Promise.resolve(this.context.workspaceState.update(STATE_KEYS.SYNC_STATUS, stateUpdate.syncStatus)),
			);
		}

		if (stateUpdate.lastSynced !== undefined) {
			updatePromises.push(
				Promise.resolve(this.context.workspaceState.update(STATE_KEYS.LAST_SYNCED, stateUpdate.lastSynced)),
			);
		}

		await Promise.all(updatePromises);
	}

	/**
	 * Resets all File Harmony configuration in `settings.json` back to their default values.
	 * This action affects only the current workspace.
	 */
	public async resetConfiguration(): Promise<void> {
		const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
		const properties = ['sourcePath', 'targetPath', 'ignoreList', 'syncMode', 'conflictResolution'] as const;

		const resetPromises = properties.map(prop =>
			config.update(prop, undefined, vscode.ConfigurationTarget.Workspace),
		);

		await Promise.all(resetPromises);
	}

	/**
	 * Performs a one-time migration from the old, monolithic workspaceState storage
	 * to the new, structured `settings.json` and ephemeral state model.
	 * This ensures a seamless update experience for existing users.
	 */
	public async performOneTimeMigration(): Promise<void> {
		const legacyState = this.context.workspaceState.get<WorkspaceState | undefined>(LEGACY_STATE_KEY);
		const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
		const isNewConfigEmpty = config.get('sourcePath') === undefined && config.get('targetPath') === undefined;

		if (legacyState && isNewConfigEmpty) {
			this.context.globalState.update('fileHarmonyMigrationLog', `Migrating legacy settings...`);
			const { syncStatus, lastSynced, ...configurableState } = legacyState;

			await this.updateConfigurationState(configurableState);
			await this.updateEphemeralState({ syncStatus, lastSynced });

			await Promise.resolve(this.context.workspaceState.update(LEGACY_STATE_KEY, undefined));
			this.context.globalState.update('fileHarmonyMigrationLog', `Migration complete.`);
		}
	}
}

export default SettingsService;
