/**
 * Defines the contract for a synchronization strategy.
 * Each strategy implements the specific logic for a given sync mode (e.g., 'smart' or 'force'),
 * providing a consistent interface for the `SyncManager` to execute a bulk sync operation.
 */
export interface ISyncStrategy {
	/**
	 * Executes the full, one-time bulk synchronization strategy.
	 */
	execute(): Promise<void>;
}
