// A simple module pattern to organize the frontend code.
document.addEventListener('DOMContentLoaded', () => {
	/**
	 * Main application object for the control panel webview.
	 * Encapsulates state, DOM elements, API communication, UI updates, and event handling.
	 */
	const app = {
		vscode: acquireVsCodeApi(),

		state: {
			currentIgnoreList: [],
			savedState: {},
		},

		dom: {
			saveButton: document.getElementById('save'),
			syncNowButton: document.getElementById('syncNow'),
			sourcePathInput: document.getElementById('sourcePath'),
			targetPathInput: document.getElementById('targetPath'),
			syncStatusCheckbox: document.getElementById('syncStatus'),
			ignoreListElement: document.getElementById('ignoreList'),
			lastSyncedTimestamp: document.getElementById('lastSyncedTimestamp'),
			conflictResolutionSelect: document.getElementById('conflictResolution'),
			ignorePatternInput: document.getElementById('ignorePatternInput'),
			addPatternButton: document.getElementById('addPatternButton'),
			viewLogButton: document.getElementById('viewLogButton'),
			resizeOverlay: document.getElementById('resize-overlay'),
			container: document.querySelector('.container'),
		},

		api: {
			/** Requests the latest state from the extension. */
			getState: () => app.vscode.postMessage({ command: 'GET_STATE' }),

			/** Sends an updated state object to the extension to be saved. */
			updateState: newState => app.vscode.postMessage({ command: 'UPDATE_STATE', value: newState }),

			/** Requests the extension to open a folder selection dialog. */
			selectFolder: forPath =>
				app.vscode.postMessage({
					command: 'SELECT_FOLDER',
					payload: { for: forPath },
				}),

			/** Triggers a one-time manual sync. */
			syncNow: () => app.vscode.postMessage({ command: 'SYNC_NOW' }),

			/** Requests the extension to show the activity log panel. */
			showLogViewer: () => app.vscode.postMessage({ command: 'SHOW_LOG_VIEWER' }),

			/** Triggers a "dry run" preview of changes. */
			previewChanges: () => app.vscode.postMessage({ command: 'PREVIEW_CHANGES' }),

			/** Requests the extension to reset workspace settings to default. */
			resetState: () => app.vscode.postMessage({ command: 'RESET_STATE' }),
		},

		ui: {
			/**
			 * Renders the list of ignore patterns in the UI based on the current state.
			 */
			renderIgnoreList() {
				app.dom.ignoreListElement.innerHTML = '';
				const uniqueIgnoreList = [...new Set(app.state.currentIgnoreList)];

				uniqueIgnoreList.forEach(listItem => {
					if (!listItem) return;
					const div = document.createElement('div');
					div.className = 'ignore-pattern';
					div.textContent = listItem;

					const removeButton = document.createElement('button');
					removeButton.className = 'remove-button';
					removeButton.textContent = 'x';

					removeButton.addEventListener('click', () => {
						app.state.currentIgnoreList = app.state.currentIgnoreList.filter(p => p !== listItem);
						app.ui.renderIgnoreList();
						app.ui.checkForUnsavedChanges();
					});

					div.appendChild(removeButton);
					app.dom.ignoreListElement.appendChild(div);
				});
			},

			/**
			 * Enables or disables the "Sync Now" button based on the conflict resolution mode.
			 * The button is disabled in 'Ask' mode to prevent "dialog hell".
			 */
			updateSyncNowButtonState() {
				const isInAskMode = app.dom.conflictResolutionSelect.value === 'Ask';
				app.dom.syncNowButton.disabled = isInAskMode;
				app.dom.syncNowButton.title = isInAskMode
					? "Sync Now is disabled when 'Ask' mode is selected. Use 'Preview' instead."
					: '';
			},

			/**
			 * Compares the current UI state to the last saved state and toggles a 'glow'
			 * effect on the Save button if there are unsaved changes.
			 */
			checkForUnsavedChanges() {
				if (Object.keys(app.state.savedState).length === 0) return;

				const currentState = {
					sourcePath: app.dom.sourcePathInput.value,
					targetPath: app.dom.targetPathInput.value,
					ignoreList: [...new Set(app.state.currentIgnoreList)].sort(),
					syncMode: document.querySelector('input[name="syncMode"]:checked').value,
					syncStatus: app.dom.syncStatusCheckbox.checked,
					conflictResolution: app.dom.conflictResolutionSelect.value,
				};

				const savedComparableState = {
					...app.state.savedState,
					ignoreList: [...new Set(app.state.savedState.ignoreList)].sort(),
				};

				const hasChanges = JSON.stringify(currentState) !== JSON.stringify(savedComparableState);
				app.dom.saveButton.classList.toggle('unsaved', hasChanges);
			},

			/**
			 * Converts an ISO 8601 timestamp into a user-friendly relative time string (e.g., "5 minutes ago").
			 * @param {string | null} isoString The timestamp to format.
			 * @returns {string} The formatted relative time string, or "Never".
			 */
			getRelativeTime(isoString) {
				if (!isoString) return 'Never';

				const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
				const units = {
					year: 31536000,
					month: 2592000,
					day: 86400,
					hour: 3600,
					minute: 60,
					second: 1,
				};
				const elapsed = (new Date(isoString).getTime() - Date.now()) / 1000;

				for (const unit in units) {
					if (Math.abs(elapsed) > units[unit] || unit === 'second') {
						return rtf.format(Math.round(elapsed / units[unit]), unit);
					}
				}

				return 'Never';
			},
		},

		handlers: {
			/**
			 * Adds a new pattern from the input field to the ignore list state.
			 */
			addPattern() {
				const newPattern = app.dom.ignorePatternInput.value.trim();
				if (newPattern && !app.state.currentIgnoreList.includes(newPattern)) {
					app.state.currentIgnoreList.push(newPattern);
					app.ui.renderIgnoreList();
					app.ui.checkForUnsavedChanges();
				}

				app.dom.ignorePatternInput.value = '';
				app.dom.ignorePatternInput.focus();
			},

			/**
			 * Gathers the current state from all form inputs and sends it to the extension to be saved.
			 */
			save() {
				const newState = {
					sourcePath: app.dom.sourcePathInput.value,
					targetPath: app.dom.targetPathInput.value,
					ignoreList: app.state.currentIgnoreList,
					syncMode: document.querySelector('input[name="syncMode"]:checked').value,
					syncStatus: app.dom.syncStatusCheckbox.checked,
					conflictResolution: app.dom.conflictResolutionSelect.value,
				};

				app.api.updateState(newState);
			},

			/**
			 * Handles incoming messages from the extension, routing them to the correct UI update logic.
			 * @param {MessageEvent} event The message event from the extension.
			 */
			handleMessage(event) {
				const message = event.data;

				switch (message.command) {
					case 'UPDATE_WEBVIEW': {
						const state = message.value;
						app.dom.sourcePathInput.value = state.sourcePath;
						app.dom.targetPathInput.value = state.targetPath;
						app.dom.syncStatusCheckbox.checked = state.syncStatus;
						document.querySelector(`input[name="syncMode"][value="${state.syncMode}"]`).checked = true;
						app.dom.lastSyncedTimestamp.textContent = app.ui.getRelativeTime(state.lastSynced);
						app.dom.conflictResolutionSelect.value = state.conflictResolution;
						app.state.currentIgnoreList = state.ignoreList;
						app.ui.renderIgnoreList();

						app.state.savedState = {
							sourcePath: state.sourcePath,
							targetPath: state.targetPath,
							ignoreList: state.ignoreList,
							syncMode: state.syncMode,
							syncStatus: state.syncStatus,
							conflictResolution: state.conflictResolution,
						};

						app.ui.checkForUnsavedChanges();
						app.ui.updateSyncNowButtonState();
						break;
					}

					case 'FOLDER_SELECTED': {
						const input =
							message.payload.for === 'source' ? app.dom.sourcePathInput : app.dom.targetPathInput;
						input.value = message.payload.path;

						app.ui.checkForUnsavedChanges();
						break;
					}
				}
			},
		},

		/**
		 * Initializes the application. Sets up all event listeners and requests the initial state.
		 */
		init() {
			app.dom.addPatternButton.addEventListener('click', app.handlers.addPattern);
			app.dom.ignorePatternInput.addEventListener('keydown', event => {
				if (event.key === 'Enter') {
					event.preventDefault();
					app.handlers.addPattern();
				}
			});
			app.dom.saveButton.addEventListener('click', app.handlers.save);
			document.getElementById('browseSource').addEventListener('click', () => app.api.selectFolder('source'));
			document.getElementById('browseTarget').addEventListener('click', () => app.api.selectFolder('target'));
			document.getElementById('syncNow').addEventListener('click', app.api.syncNow);
			document.getElementById('viewLogButton').addEventListener('click', app.api.showLogViewer);
			document.getElementById('previewChanges').addEventListener('click', app.api.previewChanges);
			document.getElementById('resetSettings').addEventListener('click', app.api.resetState);

			const inputs = [
				app.dom.syncStatusCheckbox,
				app.dom.conflictResolutionSelect,
				...document.querySelectorAll('input[name="syncMode"]'),
			];

			for (const inputElement of inputs) {
				inputElement.addEventListener('change', () => {
					app.ui.checkForUnsavedChanges();
					app.ui.updateSyncNowButtonState();
				});
			}

			window.addEventListener('message', app.handlers.handleMessage);

			new ResizeObserver(entries => {
				const isTooNarrow = entries[0].contentRect.width < 500;
				app.dom.resizeOverlay.style.display = isTooNarrow ? 'flex' : 'none';
				app.dom.container.style.display = isTooNarrow ? 'none' : 'block';
			}).observe(document.body);

			app.api.getState();
		},
	};

	app.init();
});
