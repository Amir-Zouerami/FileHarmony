export interface WorkspaceState {
	sourcePath: string;
	targetPath: string;
	syncStatus: boolean;
	ignoreList: string[];
	syncMode: 'smart' | 'force';
}
