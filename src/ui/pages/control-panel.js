document.addEventListener('DOMContentLoaded', () => {
	const vscode = acquireVsCodeApi();

	// --- Local UI State ---
	let currentIgnoreList = [];

	// --- Elements ---
	const sourcePathInput = document.getElementById('sourcePath');
	const targetPathInput = document.getElementById('targetPath');
	const syncStatusCheckbox = document.getElementById('syncStatus');
	const ignoreListElement = document.getElementById('ignoreList');
	const lastSyncedTimestamp = document.getElementById('lastSyncedTimestamp');
	const viewLogButton = document.getElementById('viewLogButton');
	const resizeOverlay = document.getElementById('resize-overlay');
	const container = document.querySelector('.container');
	// New elements for interactive ignore list
	const ignorePatternInput = document.getElementById('ignorePatternInput');
	const addPatternButton = document.getElementById('addPatternButton');

	// --- Initial State Request ---
	vscode.postMessage({ command: 'GET_STATE' });

	// --- Functions ---
	const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
	const timeUnits = {
		year: 31536000,
		month: 2592000,
		day: 86400,
		hour: 3600,
		minute: 60,
		second: 1,
	};

	function getRelativeTime(isoString) {
		if (!isoString) return 'Never';
		const then = new Date(isoString);
		const now = new Date();
		const elapsed = (then.getTime() - now.getTime()) / 1000;

		for (const unit in timeUnits) {
			if (Math.abs(elapsed) > timeUnits[unit] || unit === 'second') {
				return rtf.format(Math.round(elapsed / timeUnits[unit]), unit);
			}
		}
		return 'Never';
	}

	function renderIgnoreList() {
		ignoreListElement.innerHTML = '';
		const uniqueIgnoreList = [...new Set(currentIgnoreList)];

		uniqueIgnoreList.forEach(listItem => {
			if (listItem) {
				const div = document.createElement('div');
				div.className = 'ignore-pattern';
				div.textContent = listItem;

				const removeButton = document.createElement('button');
				removeButton.className = 'remove-button';
				removeButton.textContent = 'x';
				removeButton.addEventListener('click', () => {
					// Update the local state and re-render
					currentIgnoreList = currentIgnoreList.filter(p => p !== listItem);
					renderIgnoreList();
				});

				div.appendChild(removeButton);
				ignoreListElement.appendChild(div);
			}
		});
	}

	function addPattern() {
		const newPattern = ignorePatternInput.value.trim();
		if (newPattern && !currentIgnoreList.includes(newPattern)) {
			currentIgnoreList.push(newPattern);
			renderIgnoreList();
		}
		ignorePatternInput.value = '';
		ignorePatternInput.focus();
	}

	// --- Event Listeners ---
	addPatternButton.addEventListener('click', addPattern);
	ignorePatternInput.addEventListener('keydown', event => {
		if (event.key === 'Enter') {
			event.preventDefault(); // Prevent form submission
			addPattern();
		}
	});

	document.getElementById('browseSource').addEventListener('click', () => {
		vscode.postMessage({ command: 'SELECT_FOLDER', payload: { for: 'source' } });
	});
	document.getElementById('browseTarget').addEventListener('click', () => {
		vscode.postMessage({ command: 'SELECT_FOLDER', payload: { for: 'target' } });
	});
	document.getElementById('save').addEventListener('click', () => {
		const newState = {
			sourcePath: sourcePathInput.value,
			targetPath: targetPathInput.value,
			ignoreList: currentIgnoreList, // Send the array from our local state
			syncMode: document.querySelector('input[name="syncMode"]:checked').value,
			syncStatus: syncStatusCheckbox.checked,
		};
		vscode.postMessage({ command: 'UPDATE_STATE', value: newState });
	});
	document.getElementById('syncNow').addEventListener('click', () => {
		vscode.postMessage({ command: 'SYNC_NOW' });
	});
	viewLogButton.addEventListener('click', () => {
		vscode.postMessage({ command: 'SHOW_LOG_VIEWER' });
	});

	// --- Message Listener from Extension ---
	window.addEventListener('message', event => {
		const message = event.data;
		switch (message.command) {
			case 'UPDATE_WEBVIEW':
				sourcePathInput.value = message.value.sourcePath;
				targetPathInput.value = message.value.targetPath;
				syncStatusCheckbox.checked = message.value.syncStatus;
				document.querySelector(`input[name="syncMode"][value="${message.value.syncMode}"]`).checked = true;
				lastSyncedTimestamp.textContent = getRelativeTime(message.value.lastSynced);
				// Set the local state and render the pills
				currentIgnoreList = message.value.ignoreList;
				renderIgnoreList();
				break;
			case 'FOLDER_SELECTED':
				if (message.payload.for === 'source') {
					sourcePathInput.value = message.payload.path;
				} else if (message.payload.for === 'target') {
					targetPathInput.value = message.payload.path;
				}
				break;
		}
	});

	// --- Resize Observer for Minimum Width ---
	const resizeObserver = new ResizeObserver(entries => {
		for (const entry of entries) {
			const minWidth = 500;
			if (entry.contentRect.width < minWidth) {
				resizeOverlay.style.display = 'flex';
				container.style.display = 'none';
			} else {
				resizeOverlay.style.display = 'none';
				container.style.display = 'block';
			}
		}
	});

	resizeObserver.observe(document.body);
});
