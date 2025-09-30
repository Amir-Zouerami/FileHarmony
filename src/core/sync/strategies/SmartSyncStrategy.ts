import type { FileCopierService } from '../services/FileCopierService';
import { areFilesDifferent, isIgnored } from '../sync-utils';
import type { WorkspaceState } from '../../../shared/types';
import type { ConflictHandler } from '../ConflictHandler';
import type { Logger } from '../../../shared/Logger';
import type { ISyncStrategy } from './ISyncStrategy';
import * as path from 'node:path';
import * as fs from 'node:fs';

/**
 * Implements the 'Smart' synchronization strategy.
 * This strategy compares files before copying and will only overwrite a target file
 * if the source file is determined to be newer or different. It is the only
 * strategy that actively handles conflicts.
 */
export class SmartSyncStrategy implements ISyncStrategy {
	/**
	 * Creates an instance of SmartSyncStrategy.
	 *
	 * @param sourceRoot The absolute path to the source directory.
	 * @param targetRoot The absolute path to the target directory.
	 * @param ignoreList An array of glob patterns to exclude from the sync.
	 * @param conflictResolution The user-configured strategy for handling conflicts.
	 * @param logger The centralized logger.
	 * @param conflictHandler The service for resolving sync conflicts.
	 * @param fileCopier The service for copying files while preserving metadata.
	 */
	constructor(
		private sourceRoot: string,
		private targetRoot: string,
		private ignoreList: string[],
		private conflictResolution: WorkspaceState['conflictResolution'],
		private logger: Logger,
		private conflictHandler: ConflictHandler,
		private fileCopier: FileCopierService,
	) {}

	/**
	 * Executes the smart sync by recursively scanning the source directory.
	 */
	public async execute(): Promise<void> {
		await this.recursiveSmartSync(this.sourceRoot);
	}

	/**
	 * The recursive implementation of the smart sync. It traverses the source directory,
	 * determines if each file should be copied, and handles any conflicts.
	 *
	 * @private
	 * @param currentSource The current source directory being scanned.
	 */
	private async recursiveSmartSync(currentSource: string): Promise<void> {
		const entries = await fs.promises.readdir(currentSource, { withFileTypes: true });

		for (const entry of entries) {
			const sourceEntryPath = path.join(currentSource, entry.name);
			const relativePath = path.relative(this.sourceRoot, sourceEntryPath);

			if (isIgnored(relativePath, this.ignoreList)) {
				continue;
			}

			const targetEntryPath = path.join(this.targetRoot, relativePath);

			if (entry.isDirectory()) {
				await fs.promises.mkdir(targetEntryPath, { recursive: true });
				await this.recursiveSmartSync(sourceEntryPath);
			} else if (entry.isFile()) {
				try {
					await fs.promises.mkdir(path.dirname(targetEntryPath), { recursive: true });

					if (await this.shouldCopyFile(sourceEntryPath, targetEntryPath, relativePath)) {
						await this.fileCopier.copyFileWithMetadata(sourceEntryPath, targetEntryPath);
						this.logger.info(`Synced file (Smart): ${relativePath}`);
					}
				} catch (err) {
					this.logger.error(`Failed to sync file (Smart): ${relativePath}`, err);
				}
			}
		}
	}

	/**
	 * Determines whether a file should be copied from source to target.
	 * It checks for the target's existence, content differences, and potential conflicts.
	 *
	 * @private
	 * @param sourcePath The absolute path of the source file.
	 * @param targetPath The absolute path of the target file.
	 * @param relativePath The file path relative to the source root.
	 * @returns A promise that resolves to `true` if the file should be copied.
	 */
	private async shouldCopyFile(sourcePath: string, targetPath: string, relativePath: string): Promise<boolean> {
		if (!fs.existsSync(targetPath)) {
			return true;
		}

		const sourceStat = await fs.promises.stat(sourcePath);
		const targetStat = await fs.promises.stat(targetPath);

		if (!(await areFilesDifferent(sourcePath, sourceStat, targetPath, targetStat))) {
			return false;
		}

		if (targetStat.mtimeMs > sourceStat.mtimeMs + 2000) {
			// Bulk sync deliberately disables 'Ask' mode to prevent dialog hell.
			const effectiveResolution =
				this.conflictResolution === 'Ask' ? 'Log Error and Skip' : this.conflictResolution;

			return this.conflictHandler.handleConflict(sourcePath, targetPath, relativePath, effectiveResolution);
		}

		return true; // It's a normal update
	}
}
