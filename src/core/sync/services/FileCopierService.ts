import * as fs from 'node:fs';

/**
 * A dedicated service for handling file copy operations.
 * Its primary responsibility is to ensure that when a file is copied,
 * its original modification and access timestamps are preserved. This is critical
 * for preventing the sync logic from immediately flagging its own work as a conflict.
 */

export class FileCopierService {
	/**
	 * Copies a file from a source path to a target path and preserves its original `atime` and `mtime`.
	 *
	 * @param sourcePath The absolute path of the file to copy.
	 * @param targetPath The absolute path of the destination.
	 */
	public async copyFileWithMetadata(sourcePath: string, targetPath: string): Promise<void> {
		const sourceStat = await fs.promises.stat(sourcePath);
		await fs.promises.copyFile(sourcePath, targetPath);
		await fs.promises.utimes(targetPath, sourceStat.atime, sourceStat.mtime);
	}
}
