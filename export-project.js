// export-project.js
import fs from 'fs';
import path from 'path';

const outputFile = 'project_dump.txt'; // final big text file
const rootDir = process.cwd(); // current directory where script runs

// folders/files to skip
const ignore = [
	'node_modules',
	'.git',
	'dist',
	'build',
	'.vscode',
	'out',
	'README-resources',
	'resources',
	'coverage',
    'LICENSE',
    'package-lock.json',
	outputFile,
];

// extensions we consider "text files"
const textExtensions = [
	'.js',
	'.jsx',
	'.ts',
	'.tsx',
	'.json',
	'.html',
	'.css',
	'.scss',
	'.md',
	'.txt',
	'.yml',
	'.yaml',
	'.cjs',
	'.mjs',
];

function shouldIgnore(filePath) {
	return ignore.some(name => filePath.includes(name));
}

function isTextFile(filePath) {
	return textExtensions.includes(path.extname(filePath).toLowerCase());
}

async function collectFiles(dir) {
	const entries = await fs.promises.readdir(dir, { withFileTypes: true });
	let results = [];

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);

		if (shouldIgnore(fullPath)) continue;

		if (entry.isDirectory()) {
			results = results.concat(await collectFiles(fullPath));
		} else if (isTextFile(fullPath)) {
			results.push(fullPath);
		}
	}

	return results;
}

async function exportProject() {
	console.log(`📂 Scanning project at: ${rootDir}`);
	const files = await collectFiles(rootDir);
	let output = '';

	for (const file of files) {
		try {
			const content = await fs.promises.readFile(file, 'utf8');
			const relativePath = path.relative(rootDir, file);
			output += `\nthis is ${relativePath}:\n\`\`\`\n${content}\n\`\`\`\n`;
		} catch (err) {
			console.warn(`⚠️ Skipping ${file} (could not read: ${err.message})`);
		}
	}

	await fs.promises.writeFile(path.join(rootDir, outputFile), output, 'utf8');
	console.log(`✅ Project exported to ${outputFile}`);
}

exportProject().catch(err => {
	console.error('❌ Error exporting project:', err);
});
