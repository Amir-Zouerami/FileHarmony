document.addEventListener('DOMContentLoaded', () => {
	const logContainer = document.getElementById('log-container');
	const clearLogButton = document.getElementById('clearLogButton');

	clearLogButton.addEventListener('click', () => {
		logContainer.innerHTML = '';
	});

	/**
	 * Listens for messages from the extension. When a 'log' message is received,
	 * it creates and appends a new formatted log entry to the UI.
	 */
	window.addEventListener('message', event => {
		const message = event.data;

		if (message.command === 'log') {
			const logEntry = document.createElement('div');
			logEntry.className = 'log-entry';

			const timestampSpan = document.createElement('span');
			timestampSpan.className = 'log-timestamp';
			timestampSpan.textContent = new Date().toLocaleTimeString();

			const levelSpan = document.createElement('span');
			levelSpan.className = `log-level ${message.level}`;
			levelSpan.textContent = `[${message.level}]`;

			const messageSpan = document.createElement('span');
			messageSpan.className = 'log-message';
			const cleanMessage = message.message.substring(message.message.indexOf(']') + 2);
			messageSpan.textContent = cleanMessage;

			logEntry.appendChild(timestampSpan);
			logEntry.appendChild(levelSpan);
			logEntry.appendChild(messageSpan);
			logContainer.appendChild(logEntry);

			logContainer.scrollTop = logContainer.scrollHeight;
		}
	});
});
