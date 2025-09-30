// --- CONFIGURATION ---
export const CONFIG_SECTION = 'fileHarmony';

// --- COMMANDS ---
export const COMMAND_IDS = {
	TOGGLE_SYNC_STATUS: 'fileHarmony.toggleSyncStatus',
	GET_WATCH_STATUS: 'fileHarmony.getWatchStatus',
	SHOW_LOG_VIEWER: 'fileHarmony.showLogViewer',
	CLEAR_ERROR_STATE: 'fileHarmony.clearErrorState',
	SYNC_NOW: 'fileHarmony.syncNowWithFeedback',
} as const;

// --- VIEWS ---
export const VIEW_IDS = {
	CONTROL_PANEL: 'fileHarmonyView',
	LOG_VIEWER_PANEL: 'fileHarmonyLog',
	PREVIEW_PANEL: 'fileHarmonyPreview',
} as const;

// --- WEBVIEW MESSAGES (Extension to Webview) ---
export const WEBVIEW_MESSAGES_TO = {
	UPDATE_WEBVIEW: 'UPDATE_WEBVIEW',
	FOLDER_SELECTED: 'FOLDER_SELECTED',
	LOG: 'log',
	SHOW_CHANGES: 'showChanges',
} as const;

// --- WEBVIEW MESSAGES (Webview to Extension) ---
export const WEBVIEW_MESSAGES_FROM = {
	GET_STATE: 'GET_STATE',
	UPDATE_STATE: 'UPDATE_STATE',
	SELECT_FOLDER: 'SELECT_FOLDER',
	SYNC_NOW: 'SYNC_NOW',
	SHOW_LOG_VIEWER: 'SHOW_LOG_VIEWER',
	PREVIEW_CHANGES: 'PREVIEW_CHANGES',
	RESET_STATE: 'RESET_STATE',
	VIEW_DIFF: 'viewDiff',
} as const;
