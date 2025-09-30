import type { Logger } from '../../../shared/Logger';
import type { FSWatcher } from 'chokidar';
import chokidar from 'chokidar';

interface WatcherCallbacks {
	onAdd: (path: string) => void;
	onChange: (path: string) => void;
	onUnlink: (path: string) => void;
	onAddDir: (path: string) => void;
	onUnlinkDir: (path: string) => void;
}

/**
 * Manages the `chokidar` file watcher instance and its lifecycle.
 * This service abstracts the complexity of starting, stopping, and handling
 * events from the file system watcher, providing a clean interface for the `SyncManager`.
 */
export class FileWatcherService {
	private watcher?: FSWatcher;

	/**
	 * Creates an instance of FileWatcherService.
	 * 
	 * @param logger The centralized logger for reporting watcher status and errors.
	 */

	constructor(private logger: Logger) {}

	/**
	 * Starts the file watcher on a given source path. If a watcher is already running,
	 * it is stopped before the new one is created.
	 * 
	 * 
	 * @param sourcePath The absolute path to the directory to watch.
	 * @param ignoreList An array of glob patterns to ignore.
	 * @param callbacks An object containing callback functions for different file system events.
	 */
	public start(sourcePath: string, ignoreList: string[], callbacks: WatcherCallbacks): void {
		if (this.watcher) {
			this.stop();
		}

		this.logger.info(`Adding sync watcher to: ${sourcePath}`);
		this.watcher = chokidar.watch(sourcePath, {
			ignored: ignoreList,
			persistent: true,
			ignoreInitial: true,
			awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 10 },
		});

		this.watcher
			.on('add', callbacks.onAdd)
			.on('change', callbacks.onChange)
			.on('unlink', callbacks.onUnlink)
			.on('addDir', callbacks.onAddDir)
			.on('unlinkDir', callbacks.onUnlinkDir)
			.on('error', error => this.logger.error('Watcher error:', error));
	}

	/**
	 * Stops the currently active file watcher, if one exists.
	 */
	public async stop(): Promise<void> {
		if (this.watcher) {
			await this.watcher.close();
			this.watcher = undefined;
			this.logger.info('Sync watcher stopped.');
		}
	}

	/**
	 * Checks if the file watcher is currently active.
	 * @returns `true` if the watcher is running, `false` otherwise.
	 */
	public isActive(): boolean {
		return !!this.watcher;
	}
}
