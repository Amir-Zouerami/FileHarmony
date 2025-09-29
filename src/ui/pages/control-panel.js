document.addEventListener('DOMContentLoaded', () => {
	const vscode = acquireVsCodeApi();

	// --- Elements ---
	const sourcePathInput = document.getElementById('sourcePath');
	const targetPathInput = document.getElementById('targetPath');
	const ignoreListInput = document.getElementById('ignoreListInput');
	const syncStatusCheckbox = document.getElementById('syncStatus');
	const ignoreListElement = document.getElementById('ignoreList');

	// --- Initial State Request ---
	vscode.postMessage({ command: 'GET_STATE' });

	// --- Functions ---
	function renderIgnoreList(ignoreList) {
		ignoreListElement.innerHTML = '';
		const uniqueIgnoreList = [...new Set(ignoreList)];

		uniqueIgnoreList.forEach(listItem => {
			if (listItem) {
				const div = document.createElement('div');
				div.className = 'ignore-pattern';
				div.textContent = listItem;

				const removeButton = document.createElement('button');
				removeButton.className = 'remove-button';
				removeButton.textContent = 'x';
				removeButton.addEventListener('click', () => {
					const updatedList = uniqueIgnoreList.filter(p => p !== listItem);
					ignoreListInput.value = updatedList.join(',');
					renderIgnoreList(updatedList);
				});

				div.appendChild(removeButton);
				ignoreListElement.appendChild(div);
			}
		});
	}

	// --- Event Listeners ---
	document.getElementById('browseSource').addEventListener('click', () => {
		vscode.postMessage({ command: 'SELECT_FOLDER', payload: { for: 'source' } });
	});

	document.getElementById('browseTarget').addEventListener('click', () => {
		vscode.postMessage({ command: 'SELECT_FOLDER', payload: { for: 'target' } });
	});

	document.getElementById('save').addEventListener('click', async () => {
		const currIgnoreList = ignoreListInput.value
			.split(',')
			.map(item => item.trim())
			.filter(Boolean);

		const newState = {
			sourcePath: sourcePathInput.value,
			targetPath: targetPathInput.value,
			ignoreList: currIgnoreList,
			syncMode: document.querySelector('input[name="syncMode"]:checked').value,
			syncStatus: syncStatusCheckbox.checked,
		};

		await vscode.postMessage({ command: 'UPDATE_STATE', value: newState });
	});

	window.addEventListener('message', event => {
		const message = event.data;

		if (message.command === 'UPDATE_WEBVIEW') {
			sourcePathInput.value = message.value.sourcePath;
			targetPathInput.value = message.value.targetPath;
			ignoreListInput.value = message.value.ignoreList.join(',');
			syncStatusCheckbox.checked = message.value.syncStatus;

			document.querySelector(`input[name="syncMode"][value="${message.value.syncMode}"]`).checked = true;
			renderIgnoreList(message.value.ignoreList);
		}

		if (message.command === 'FOLDER_SELECTED') {
			if (message.payload.for === 'source') {
				sourcePathInput.value = message.payload.path;
			} else if (message.payload.for === 'target') {
				targetPathInput.value = message.payload.path;
			}
		}
	});
});
