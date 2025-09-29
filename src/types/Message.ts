import type { WorkspaceState } from './WorkspaceState';

export interface UpdateStateMessage {
	command: 'UPDATE_STATE';
	value: WorkspaceState;
}

export interface GetStateMessage {
	command: 'GET_STATE';
}

export interface SelectFolderMessage {
	command: 'SELECT_FOLDER';
	payload: {
		for: 'source' | 'target';
	};
}

export type Message = UpdateStateMessage | GetStateMessage | SelectFolderMessage;
