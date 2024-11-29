import * as vscode from 'vscode';
import { WorkspaceState } from '../types/WorkspaceState';

class WorkspaceStateManager {
	private defaultState: WorkspaceState;
	private stateKeyName = 'FILE_HARMONY';
	private context: vscode.ExtensionContext;

	constructor(context: vscode.ExtensionContext) {
		this.context = context;
		this.defaultState = {
			sourcePath: '',
			targetPath: '',
			ignoreList: ['node_modules', '.vscode', '.idea', '.git'],
			syncStatus: false,
		};
	}

	getState() {
		const currState: WorkspaceState = this.context.workspaceState.get(this.stateKeyName, this.defaultState);
		return currState;
	}

	updateState(newState: Partial<WorkspaceState>) {
		const nextState = { ...this.getState(), ...newState };
		nextState.ignoreList = nextState.ignoreList.map(item => item.trim());

		this.context.workspaceState.update(this.stateKeyName, nextState);
	}
}

export default WorkspaceStateManager;
