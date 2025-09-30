/**
 * Thrown when a required source or target directory does not exist on the filesystem.
 */
export class DirectoryNotFoundError extends Error {
	constructor(path: string) {
		super(`The specified directory does not exist: ${path}`);
		this.name = 'DirectoryNotFoundError';
	}
}

/**
 * Thrown when the configuration paths are invalid (e.g., source and target are the same).
 */
export class InvalidPathError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'InvalidPathError';
	}
}

/**
 * Thrown when an operation is attempted without an active workspace/folder open.
 */
export class NoWorkspaceOpenError extends Error {
	constructor() {
		super('This operation requires an open folder or workspace.');
		this.name = 'NoWorkspaceOpenError';
	}
}
