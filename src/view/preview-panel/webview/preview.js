document.addEventListener('DOMContentLoaded', () => {
	const vscode = acquireVsCodeApi();
	const container = document.getElementById('changes-container');
	const summarySpan = document.getElementById('summary');

	/**
	 * Listens for messages from the extension. When a 'showChanges' message is received,
	 * it triggers the rendering of the sync preview.
	 */
	window.addEventListener('message', event => {
		const message = event.data;

		if (message.command === 'showChanges') {
			renderChanges(message.changes);
		}
	});

	/**
	 * Renders the list of detected changes in the webview.
	 * It groups changes by type (e.g., CREATE, UPDATE) and creates the corresponding UI elements.
	 * It also attaches click listeners to items that can be diffed.
	 * @param {Array<object>} changes The array of ChangeLog objects from the extension.
	 */
	function renderChanges(changes) {
		container.innerHTML = ''; // Clear previous results

		if (!changes || changes.length === 0) {
			container.innerHTML = '<h2>No changes detected. Directories are in sync.</h2>';
			summarySpan.textContent = '';
			return;
		}

		const grouped = {};

		for (const change of changes) {
			const type = change.type;

			if (!grouped[type]) {
				grouped[type] = [];
			}

			grouped[type].push(change);
		}

		const summary = Object.keys(grouped)
			.map(key => `${grouped[key].length} ${key.toLowerCase().replace(/_/g, ' ')}`)
			.join(', ');

		summarySpan.textContent = `Summary: ${summary}.`;

		/**
		 * Renders a single group of changes (e.g., all "UPDATE" changes).
		 * @param {string} title The display title for the group.
		 * @param {string} type The change type key (e.g., 'UPDATE').
		 */
		const renderGroup = (title, type) => {
			if (!grouped[type]) return;

			const header = document.createElement('h2');
			header.textContent = title;
			container.appendChild(header);

			const list = document.createElement('ul');
			list.className = 'change-list';
			container.appendChild(list);

			grouped[type].forEach(change => {
				const item = document.createElement('li');
				item.className = 'change-item';

				// --- Make CONFLICT items clickable for diffing ---
				if (change.type === 'UPDATE' || change.type === 'CONFLICT') {
					item.classList.add('updateable');
					item.title = 'Click to view diff';
					/**
					 * When a diffable item is clicked, post a 'viewDiff' message
					 * back to the extension with the necessary file paths.
					 */
					item.addEventListener('click', () => {
						vscode.postMessage({
							command: 'viewDiff',
							sourcePath: change.sourcePath,
							targetPath: change.targetPath,
							relativePath: change.relativePath,
						});
					});
				}

				const typeSpan = document.createElement('span');
				typeSpan.className = `change-type ${change.type.toLowerCase()}`;
				typeSpan.textContent = change.type.replace(/_/g, ' ');

				const pathSpan = document.createElement('span');
				pathSpan.className = 'change-path';
				pathSpan.textContent = change.relativePath;

				item.appendChild(typeSpan);
				item.appendChild(pathSpan);
				list.appendChild(item);
			});
		};

		// --- Render in a logical order ---
		renderGroup('Conflicts (Target is Newer)', 'CONFLICT');
		renderGroup('Files to be Updated', 'UPDATE');
		renderGroup('Files to be Created', 'CREATE');
		renderGroup('Files to be Deleted', 'DELETE');
		renderGroup('Warnings (Only in Target)', 'WARNING_ONLY_IN_TARGET');
	}
});
