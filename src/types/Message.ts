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

export interface SyncNowMessage {
	command: 'SYNC_NOW';
}

export interface LogUpdatedMessage {
	command: 'LOG_UPDATED';
	payload: string;
}

export interface ShowLogViewerMessage {
	command: 'SHOW_LOG_VIEWER';
}

export type Message =
	| UpdateStateMessage
	| GetStateMessage
	| SelectFolderMessage
	| SyncNowMessage
	| ShowLogViewerMessage;
