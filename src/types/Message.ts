import { WorkspaceState } from './WorkspaceState';

export interface UpdateStateMessage {
	command: 'UPDATE_STATE';
	value: WorkspaceState;
}

export interface GetStateMessage {
	command: 'GET_STATE';
}

export type Message = UpdateStateMessage | GetStateMessage;
