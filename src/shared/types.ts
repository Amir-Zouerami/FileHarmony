import type { WEBVIEW_MESSAGES_FROM, WEBVIEW_MESSAGES_TO } from './constants';

export interface ChangeLog {
	type: 'CREATE' | 'UPDATE' | 'DELETE' | 'CONFLICT' | 'WARNING_ONLY_IN_TARGET';
	relativePath: string;
	sourcePath?: string;
	targetPath?: string;
}

export interface UpdateStateMessage {
	command: typeof WEBVIEW_MESSAGES_FROM.UPDATE_STATE;
	value: WorkspaceState;
}

export interface GetStateMessage {
	command: typeof WEBVIEW_MESSAGES_FROM.GET_STATE;
}

export interface SelectFolderMessage {
	command: typeof WEBVIEW_MESSAGES_FROM.SELECT_FOLDER;
	payload: {
		for: 'source' | 'target';
	};
}

export interface SyncNowMessage {
	command: typeof WEBVIEW_MESSAGES_FROM.SYNC_NOW;
}

export interface ShowLogViewerMessage {
	command: typeof WEBVIEW_MESSAGES_FROM.SHOW_LOG_VIEWER;
}

export interface PreviewChangesMessage {
	command: typeof WEBVIEW_MESSAGES_FROM.PREVIEW_CHANGES;
}

export interface ResetStateMessage {
	command: typeof WEBVIEW_MESSAGES_FROM.RESET_STATE;
}

export interface LogUpdatedMessage {
	command: typeof WEBVIEW_MESSAGES_TO.LOG;
	level: 'INFO' | 'WARN' | 'ERROR';
	message: string;
}

export type Message =
	| UpdateStateMessage
	| GetStateMessage
	| SelectFolderMessage
	| SyncNowMessage
	| ShowLogViewerMessage
	| PreviewChangesMessage
	| ResetStateMessage;

export interface WorkspaceState {
	sourcePath: string;
	targetPath: string;
	syncStatus: boolean;
	ignoreList: string[];
	syncMode: 'smart' | 'force';
	lastSynced: string | null;
	conflictResolution: 'Source Wins' | 'Target Wins' | 'Log Error and Skip' | 'Ask';
}
