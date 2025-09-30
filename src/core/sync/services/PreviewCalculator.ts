import { areFilesDifferent, isIgnored } from '../sync-utils';
import type { ChangeLog } from '../../../shared/types';
import type { Logger } from '../../../shared/Logger';
import * as path from 'node:path';
import * as fs from 'node:fs';

/**
 * A service dedicated to calculating a "dry run" of a synchronization.
 * It scans the source and target directories to build a comprehensive list of pending changes
 * (creations, updates, conflicts, and orphans) without modifying any files.
 */
export class PreviewCalculator {
	/**
	 * Creates an instance of PreviewCalculator.
	 *
	 * @param logger The centralized logger for reporting progress and errors.
	 */
	constructor(private logger: Logger) {}

	/**
	 * Calculates the list of changes required to sync the source to the target.
	 *
	 * @param sourceRoot The absolute path to the source directory.
	 * @param targetRoot The absolute path to the target directory.
	 * @param ignoreList An array of glob patterns to exclude from the calculation.
	 * @returns A promise that resolves to an array of `ChangeLog` objects representing all pending operations.
	 */
	public async calculate(sourceRoot: string, targetRoot: string, ignoreList: string[]): Promise<ChangeLog[]> {
		this.logger.info(`Calculating preview from "${sourceRoot}" to "${targetRoot}".`);
		const changes: ChangeLog[] = [];

		await this.recursivePreviewScan(sourceRoot, targetRoot, ignoreList, sourceRoot, changes);
		await this.recursiveOrphanScan(sourceRoot, targetRoot, ignoreList, targetRoot, changes);

		this.logger.info(`Preview calculation finished. Found ${changes.length} potential changes.`);
		return changes;
	}

	/**
	 * Recursively scans the source directory to find files that need to be created or updated in the target.
	 *
	 * @private
	 * @param currentSource The current source directory being scanned.
	 * @param currentTarget The corresponding target directory.
	 * @param ignoreList The list of glob patterns to ignore.
	 * @param rootSource The root source directory of the entire operation.
	 * @param changes The array where detected changes are accumulated.
	 */
	private async recursivePreviewScan(
		currentSource: string,
		currentTarget: string,
		ignoreList: string[],
		rootSource: string,
		changes: ChangeLog[],
	): Promise<void> {
		const entries = await fs.promises.readdir(currentSource, { withFileTypes: true });

		for (const entry of entries) {
			const sourceEntryPath = path.join(currentSource, entry.name);
			const relativePath = path.relative(rootSource, sourceEntryPath);
			if (isIgnored(relativePath, ignoreList)) continue;

			const targetEntryPath = path.join(currentTarget, entry.name);

			if (entry.isDirectory()) {
				await this.recursivePreviewScan(sourceEntryPath, targetEntryPath, ignoreList, rootSource, changes);
			} else if (entry.isFile()) {
				try {
					if (!fs.existsSync(targetEntryPath)) {
						changes.push({
							type: 'CREATE',
							relativePath,
							sourcePath: sourceEntryPath,
							targetPath: targetEntryPath,
						});
					} else {
						const sourceStat = await fs.promises.stat(sourceEntryPath);
						const targetStat = await fs.promises.stat(targetEntryPath);

						if (await areFilesDifferent(sourceEntryPath, sourceStat, targetEntryPath, targetStat)) {
							const changeType = sourceStat.mtimeMs > targetStat.mtimeMs ? 'UPDATE' : 'CONFLICT';

							changes.push({
								type: changeType,
								relativePath,
								sourcePath: sourceEntryPath,
								targetPath: targetEntryPath,
							});
						}
					}
				} catch (err) {
					this.logger.error(`Error during preview calculation for ${relativePath}`, err);
				}
			}
		}
	}

	/**
	 * Recursively scans the target directory to find "orphan" files—those that exist in the target
	 * but not in the source. These are flagged as warnings.
	 *
	 * @private
	 * @param rootSource The root source directory of the entire operation.
	 * @param currentTarget The current target directory being scanned.
	 * @param ignoreList The list of glob patterns to ignore.
	 * @param rootTarget The root target directory of the entire operation.
	 * @param changes The array where detected changes are accumulated.
	 */
	private async recursiveOrphanScan(
		rootSource: string,
		currentTarget: string,
		ignoreList: string[],
		rootTarget: string,
		changes: ChangeLog[],
	): Promise<void> {
		const entries = await fs.promises.readdir(currentTarget, { withFileTypes: true });

		for (const entry of entries) {
			const targetEntryPath = path.join(currentTarget, entry.name);
			const relativePath = path.relative(rootTarget, targetEntryPath);
			const sourceEntryPath = path.join(rootSource, relativePath);

			if (isIgnored(relativePath, ignoreList)) continue;

			if (!fs.existsSync(sourceEntryPath)) {
				changes.push({
					type: 'WARNING_ONLY_IN_TARGET',
					relativePath,
					sourcePath: undefined,
					targetPath: targetEntryPath,
				});
			} else if (entry.isDirectory()) {
				await this.recursiveOrphanScan(rootSource, targetEntryPath, ignoreList, rootTarget, changes);
			}
		}
	}
}
