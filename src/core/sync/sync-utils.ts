import * as crypto from 'node:crypto';
import micromatch from 'micromatch';
import * as path from 'node:path';
import * as vscode from 'vscode';
import * as fs from 'node:fs';

/**
 * Calculates the SHA-256 checksum of a file asynchronously.
 *
 * @param filePath The absolute path to the file.
 * @returns A promise that resolves to the hex digest of the file's content.
 */
function calculateChecksum(filePath: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const hash = crypto.createHash('sha256');
		const stream = fs.createReadStream(filePath);

		stream.on('data', data => hash.update(data));
		stream.on('end', () => resolve(hash.digest('hex')));
		stream.on('error', err => reject(err));
	});
}

/**
 * Performs a multi-stage check to definitively determine if two files are different.
 * The process is optimized for speed:
 * 1. Compares file size (fastest).
 * 2. Compares modification time with a 2-second tolerance to account for filesystem inaccuracies.
 * 3. Compares SHA-256 checksums (definitive, but slowest) only if the first two checks are ambiguous.
 *
 * @param sourcePath The path to the source file.
 * @param sourceStat The stats object for the source file.
 * @param targetPath The path to the target file.
 * @param targetStat The stats object for the target file.
 * @returns A promise that resolves to `true` if the files are different, `false` otherwise.
 */
export async function areFilesDifferent(
	sourcePath: string,
	sourceStat: fs.Stats,
	targetPath: string,
	targetStat: fs.Stats,
): Promise<boolean> {
	if (sourceStat.size !== targetStat.size) {
		return true;
	}

	if (Math.abs(sourceStat.mtimeMs - targetStat.mtimeMs) > 2000) {
		return true;
	}

	const sourceHash = await calculateChecksum(sourcePath);
	const targetHash = await calculateChecksum(targetPath);
	return sourceHash !== targetHash;
}

/**
 * Checks if a given file path matches any of the provided glob patterns using micromatch.
 * It normalizes path separators to forward slashes for cross-platform compatibility.
 *
 * @param filePath The relative path of the file to check.
 * @param ignoreList An array of glob patterns.
 * @returns `true` if the path should be ignored, `false` otherwise.
 */
export function isIgnored(filePath: string, ignoreList: string[]): boolean {
	const normalizedPath = filePath.replace(/\\/g, '/');
	return micromatch.isMatch(normalizedPath, ignoreList);
}

/**
 * Converts potentially relative source and target paths into absolute paths.
 * If a path is not already absolute, it resolves it relative to the root of the current workspace folder.
 *
 * @param sourcePath The source path from configuration.
 * @param targetPath The target path from configuration.
 * @returns An object containing the resolved absolute source and target paths.
 */
export function convertToAbsolutePath(sourcePath: string, targetPath: string) {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

	return {
		resolvedSourcePath: path.isAbsolute(sourcePath) ? sourcePath : path.resolve(workspaceFolder, sourcePath),
		resolvedTargetPath: path.isAbsolute(targetPath) ? targetPath : path.resolve(workspaceFolder, targetPath),
	};
}
