import { App, TFile } from 'obsidian';
import type { TaskViewsSettings } from './settings';

export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'migrated' | 'bookmark';

export interface Task {
	file: TFile;
	line: number;
	indent: number;
	status: TaskStatus;
	description: string;
	scheduled: string | null;
	due: string | null;
	recurrence: string | null;
	priority: 'highest' | 'high' | 'normal' | 'low' | 'lowest';
	startDate: string | null;
	completionDate: string | null;
	createdDate: string | null;
	taskId: string | null;
	dependsOn: string | null;
	heading: string | null;   // nearest heading above this task in the source file
	children: Task[];
}

const STATUS_MAP: Record<string, TaskStatus> = {
	' ': 'todo',
	'/': 'in-progress',
	'x': 'done',
	'X': 'done',
	'>': 'migrated',
	'b': 'bookmark',
};

// Matches:  - [ ] text   with any leading whitespace
const TASK_LINE_RE = /^(\s*)- \[(.)\] (.*)$/;
const DATE_RE = /(\d{4}-\d{2}-\d{2})/;

type DateKey = 'scheduled' | 'due' | 'startDate' | 'completionDate' | 'createdDate';

const DATE_FIELDS: Array<{ emoji: string; key: DateKey }> = [
	{ emoji: '⏳', key: 'scheduled' },
	{ emoji: '📅', key: 'due' },
	{ emoji: '🛫', key: 'startDate' },
	{ emoji: '✅', key: 'completionDate' },
	{ emoji: '➕', key: 'createdDate' },
];

function parseTaskLine(raw: string, file: TFile, lineIndex: number): Task | null {
	const match = TASK_LINE_RE.exec(raw);
	if (!match) return null;

	const indentStr = match[1] ?? '';
	const statusChar = match[2] ?? ' ';
	const body = match[3] ?? '';

	const status: TaskStatus = STATUS_MAP[statusChar] ?? 'todo';

	const task: Task = {
		file,
		line: lineIndex,
		indent: indentStr.length,
		status,
		description: body,
		scheduled: null,
		due: null,
		recurrence: null,
		priority: 'normal',
		startDate: null,
		completionDate: null,
		createdDate: null,
		taskId: null,
		dependsOn: null,
		heading: null,
		children: [],
	};

	// Extract date fields
	for (const { emoji, key } of DATE_FIELDS) {
		const idx = body.indexOf(emoji);
		if (idx !== -1) {
			const after = body.slice(idx + emoji.length).trimStart();
			const dateMatch = DATE_RE.exec(after);
			if (dateMatch && dateMatch[1]) {
				task[key] = dateMatch[1];
			}
		}
	}

	// Recurrence
	const recurIdx = body.indexOf('🔁');
	if (recurIdx !== -1) {
		const afterRecur = body.slice(recurIdx + '🔁'.length).trim();
		const nextEmoji = afterRecur.search(/[⏳📅🛫✅➕⏫🔼🔽⬇️🆔⛔]/u);
		task.recurrence = nextEmoji === -1 ? afterRecur : afterRecur.slice(0, nextEmoji).trim();
	}

	// Priority
	if (body.includes('⏫')) task.priority = 'highest';
	else if (body.includes('🔼')) task.priority = 'high';
	else if (body.includes('🔽')) task.priority = 'low';
	else if (body.includes('⬇️')) task.priority = 'lowest';

	// Task ID and depends-on
	const idMatch = /🆔\s*(\S+)/.exec(body);
	if (idMatch?.[1]) task.taskId = idMatch[1];
	const depMatch = /⛔\s*(\S+)/.exec(body);
	if (depMatch?.[1]) task.dependsOn = depMatch[1];

	// Strip all emoji metadata from description
	task.description = body
		.replace(/[⏳📅🛫✅➕]\s*\d{4}-\d{2}-\d{2}/gu, '')
		.replace(/🔁[^⏳📅🛫✅➕⏫🔼🔽⬇️🆔⛔]*/gu, '')
		.replace(/[⏫🔼🔽⬇️🆔⛔]\s*\S*/gu, '')
		.replace(/\s{2,}/g, ' ')
		.trim();

	return task;
}

function isExcluded(filePath: string, excludedFolders: string[]): boolean {
	return excludedFolders.some((folder) => {
		const f = folder.trim();
		return f.length > 0 && filePath.startsWith(f + '/');
	});
}

export async function scanVault(app: App, settings: TaskViewsSettings): Promise<Task[]> {
	const excludedFolders = settings.excludedFolders
		.split(',')
		.map((f) => f.trim())
		.filter((f) => f.length > 0);

	const mdFiles = app.vault.getMarkdownFiles();
	const allTasks: Task[] = [];

	for (const file of mdFiles) {
		if (isExcluded(file.path, excludedFolders)) continue;

		let content: string;
		try {
			content = await app.vault.read(file);
		} catch {
			continue;
		}

		const lines = content.split('\n');
		const fileTasks: Task[] = [];
		let currentHeading: string | null = null;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line === undefined) continue;

			const headingMatch = /^#{1,6}\s+(.+)$/.exec(line);
			if (headingMatch?.[1]) {
				currentHeading = headingMatch[1].trim();
				continue;
			}

			const task = parseTaskLine(line, file, i);
			if (task) {
				task.heading = currentHeading;
				fileTasks.push(task);
			}
		}

		// Build parent-child relationships within this file
		const rootTasks: Task[] = [];
		const stack: Task[] = [];

		for (const task of fileTasks) {
			while (stack.length > 0 && (stack[stack.length - 1]?.indent ?? 0) >= task.indent) {
				stack.pop();
			}

			const parent = stack[stack.length - 1];
			if (parent) {
				parent.children.push(task);
			} else {
				rootTasks.push(task);
			}

			stack.push(task);
		}

		allTasks.push(...rootTasks);
	}

	return allTasks;
}
