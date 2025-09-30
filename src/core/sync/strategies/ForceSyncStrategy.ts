import type { FileCopierService } from '../services/FileCopierService';
import type { ISyncStrategy } from './ISyncStrategy';
import type { Logger } from '../../../shared/Logger';
import { isIgnored } from '../sync-utils';
import * as path from 'node:path';
import * as fs from 'node:fs';

/**
 * Implements the 'Force Overwrite' synchronization strategy.
 * This strategy ensures the target directory becomes an exact mirror of the source
 * by overwriting every file in the target that also exists in the source,
 * regardless of timestamps or content.
 */
export class ForceSyncStrategy implements ISyncStrategy {
	/**
	 * Creates an instance of ForceSyncStrategy.
	 *
	 * @param sourceRoot The absolute path to the source directory.
	 * @param targetRoot The absolute path to the target directory.
	 * @param ignoreList An array of glob patterns to exclude from the sync.
	 * @param logger The centralized logger.
	 * @param fileCopier The service for copying files while preserving metadata.
	 */
	constructor(
		private sourceRoot: string,
		private targetRoot: string,
		private ignoreList: string[],
		private logger: Logger,
		private fileCopier: FileCopierService,
	) {}

	/**
	 * Executes the force sync by recursively scanning the source directory and copying all files.
	 */
	public async execute(): Promise<void> {
		await this.recursiveForceSync(this.sourceRoot);
	}

	/**
	 * The recursive implementation of the force sync. It traverses the source directory
	 * and copies each file and folder to the target.
	 *
	 * @private
	 * @param currentSource The current source directory being scanned.
	 */
	private async recursiveForceSync(currentSource: string): Promise<void> {
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
				await this.recursiveForceSync(sourceEntryPath);
			} else if (entry.isFile()) {
				try {
					await fs.promises.mkdir(path.dirname(targetEntryPath), { recursive: true });
					await this.fileCopier.copyFileWithMetadata(sourceEntryPath, targetEntryPath);
					this.logger.info(`Synced file (Force): ${relativePath}`);
				} catch (err) {
					this.logger.error(`Failed to sync file (Force): ${relativePath}`, err);
				}
			}
		}
	}
}
