import { ItemView, MarkdownView, TFile, WorkspaceLeaf, setIcon } from 'obsidian';
import type TaskViewsPlugin from './main';
import { scanVault, Task } from './parser';

export const VIEW_TYPE_TASKS_SIDEBAR = 'tasks-view-sidebar';

const HEADING_RE = /^#{1,6}\s+/;

function getToday(): string {
	return new Date().toISOString().split('T')[0] as string;
}

function formatDate(dateStr: string): string {
	const [year, month, day] = dateStr.split('-');
	return `${month}/${day}/${year?.slice(2)}`;
}

function getGroupKey(task: Task, groupBy: 'note' | 'heading'): string {
	if (groupBy === 'heading') {
		return task.heading ?? task.file.basename;
	}
	return task.file.basename;
}

export class TasksSidebarView extends ItemView {
	private plugin: TaskViewsPlugin;
	private allTasks: Task[] = [];
	private collapsedGroups: Set<string> = new Set(['__overdue__']);

	constructor(leaf: WorkspaceLeaf, plugin: TaskViewsPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_TASKS_SIDEBAR;
	}

	getDisplayText(): string {
		return 'Tasks';
	}

	getIcon(): string {
		return 'checkmark';
	}

	async onOpen(): Promise<void> {
		this.renderPlaceholder('Scanning vault…');
		this.allTasks = await scanVault(this.app, this.plugin.settings);
		this.render();
		this.registerVaultWatcher();
	}

	async onClose(): Promise<void> {}

	private registerVaultWatcher() {
		// Debounce re-scans so rapid saves (e.g. Tasks writing recurrence) don't pile up
		let debounceTimer: ReturnType<typeof setTimeout> | null = null;

		this.registerEvent(
			this.app.vault.on('modify', async (file) => {
				if (!(file instanceof TFile) || file.extension !== 'md') return;
				if (debounceTimer) clearTimeout(debounceTimer);
				debounceTimer = setTimeout(async () => {
					this.allTasks = await scanVault(this.app, this.plugin.settings);
					this.render();
				}, 300);
			}),
		);
	}

	private render() {
		const today = getToday();
		const { showCompleted, showMigrated, groupBy } = this.plugin.settings;

		// Flatten all tasks (including children) for today filtering
		const flatten = (tasks: Task[]): Task[] =>
			tasks.flatMap((t) => [t, ...flatten(t.children)]);
		const flat = flatten(this.allTasks);

		const isToday = (t: Task) => t.scheduled === today || t.due === today;

		const todayTasks = flat.filter((t) => {
			if (t.status === 'bookmark') return false;
			if (t.status === 'migrated' && !showMigrated) return false;
			if (t.status === 'done' && !showCompleted) return false;
			return isToday(t);
		});

		// Group tasks
		const groups = new Map<string, Task[]>();
		for (const task of todayTasks) {
			const key = getGroupKey(task, groupBy);
			if (!groups.has(key)) groups.set(key, []);
			groups.get(key)!.push(task);
		}

		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('tasks-view-container');

		// Overdue tasks (before today, not done, not migrated, not bookmark)
		const overdueTasks = flat.filter(
			(t) =>
				t.status !== 'done' &&
				t.status !== 'migrated' &&
				t.status !== 'bookmark' &&
				((t.scheduled && t.scheduled < today) || (t.due && t.due < today)),
		);

		// Quick add
		this.renderQuickAdd(container);

		// Scroll area
		const scroll = container.createEl('div', { cls: 'tasks-view-scroll' });

		// Overdue banner
		if (overdueTasks.length > 0) {
			this.renderOverdueBanner(scroll, overdueTasks, today);
		}

		if (todayTasks.length === 0) {
			const empty = scroll.createEl('div', { cls: 'tasks-view-empty' });
			setIcon(empty.createEl('div', { cls: 'tasks-view-empty-icon' }), 'checkmark');
			empty.createEl('p', { text: 'Nothing scheduled for today.' });
		} else {
			for (const [groupName, tasks] of groups) {
				this.renderGroup(scroll, groupName, tasks, today);
			}
		}

		this.renderStats(container, flat, today);
	}

	private renderQuickAdd(container: HTMLElement) {
		const inboxName = this.plugin.settings.inboxFilePath.split('/').pop() ?? 'Inbox.md';

		const wrap = container.createEl('div', { cls: 'tasks-view-quick-add' });
		const input = wrap.createEl('input', {
			cls: 'tasks-view-quick-add-input',
			attr: { placeholder: 'Add to inbox…', type: 'text' },
		}) as HTMLInputElement;
		wrap.createEl('span', { cls: 'tasks-view-quick-add-label', text: `📥 ${inboxName}` });

		input.addEventListener('keydown', async (e) => {
			if (e.key === 'Enter') {
				const text = input.value.trim();
				if (text) {
					await this.addToInbox(text);
					input.value = '';
				}
			} else if (e.key === 'Escape') {
				input.value = '';
				input.blur();
			}
		});
	}

	private async addToInbox(text: string) {
		const { inboxFilePath } = this.plugin.settings;
		const vault = this.app.vault;

		let file = vault.getFileByPath(inboxFilePath);
		if (!file) {
			// Create the file if it doesn't exist
			file = await vault.create(inboxFilePath, '');
		}

		const existing = await vault.read(file);
		const newLine = `- [ ] ${text}`;
		const updated = existing.endsWith('\n') || existing === ''
			? existing + newLine + '\n'
			: existing + '\n' + newLine + '\n';

		await vault.modify(file, updated);
	}

	private renderOverdueBanner(parent: HTMLElement, tasks: Task[], today: string) {
		const isCollapsed = this.collapsedGroups.has('__overdue__');

		const banner = parent.createEl('div', { cls: 'tasks-view-overdue-banner' });

		const header = banner.createEl('div', { cls: 'tasks-view-overdue-header' });
		const chevron = header.createEl('div', { cls: 'tasks-view-group-chevron' });
		setIcon(chevron, isCollapsed ? 'chevron-right' : 'chevron-down');
		header.createEl('span', { cls: 'tasks-view-overdue-label', text: 'Overdue' });
		header.createEl('span', { cls: 'tasks-view-overdue-count', text: String(tasks.length) });

		const body = banner.createEl('div', { cls: 'tasks-view-overdue-body' });
		if (isCollapsed) body.addClass('is-collapsed');

		for (const task of tasks) {
			this.renderTaskItem(body, task, today, 0);
		}

		header.addEventListener('click', () => {
			if (this.collapsedGroups.has('__overdue__')) {
				this.collapsedGroups.delete('__overdue__');
				body.removeClass('is-collapsed');
				setIcon(chevron, 'chevron-down');
			} else {
				this.collapsedGroups.add('__overdue__');
				body.addClass('is-collapsed');
				setIcon(chevron, 'chevron-right');
			}
		});
	}

	private renderGroup(parent: HTMLElement, groupName: string, tasks: Task[], today: string) {
		const isCollapsed = this.collapsedGroups.has(groupName);

		const group = parent.createEl('div', { cls: 'tasks-view-group' });

		// Header
		const header = group.createEl('div', { cls: 'tasks-view-group-header' });

		const chevron = header.createEl('div', { cls: 'tasks-view-group-chevron' });
		setIcon(chevron, isCollapsed ? 'chevron-right' : 'chevron-down');

		header.createEl('span', { cls: 'tasks-view-group-name', text: groupName });
		header.createEl('span', { cls: 'tasks-view-group-count', text: String(tasks.length) });

		// Body
		const body = group.createEl('div', { cls: 'tasks-view-group-body' });
		if (isCollapsed) body.addClass('is-collapsed');

		for (const task of tasks) {
			this.renderTaskItem(body, task, today, 0);
		}

		header.addEventListener('click', () => {
			if (this.collapsedGroups.has(groupName)) {
				this.collapsedGroups.delete(groupName);
				body.removeClass('is-collapsed');
				setIcon(chevron, 'chevron-down');
			} else {
				this.collapsedGroups.add(groupName);
				body.addClass('is-collapsed');
				setIcon(chevron, 'chevron-right');
			}
		});
	}

	private renderTaskItem(parent: HTMLElement, task: Task, today: string, depth: number) {
		const isDone = task.status === 'done';

		const item = parent.createEl('div', {
			cls: `tasks-view-task-item${isDone ? ' is-done' : ''}`,
		});
		if (depth > 0) item.style.paddingLeft = `${depth * 20 + 12}px`;

		// Checkbox
		const checkbox = item.createEl('div', { cls: 'tasks-view-task-checkbox' });
		const checkInput = checkbox.createEl('input', { attr: { type: 'checkbox' } }) as HTMLInputElement;
		if (isDone) checkInput.checked = true;
		if (task.status === 'in-progress') checkbox.addClass('is-in-progress');

		checkInput.addEventListener('click', (e) => {
			e.preventDefault();
			this.toggleTask(task, item, checkInput);
		});

		// Content
		const content = item.createEl('div', { cls: 'tasks-view-task-content' });
		content.createEl('div', { cls: 'tasks-view-task-description', text: task.description });

		// Meta row
		const hasMeta = task.scheduled || task.due || task.recurrence;
		if (hasMeta) {
			const meta = content.createEl('div', { cls: 'tasks-view-task-meta' });

			if (task.scheduled) {
				const el = meta.createEl('span', { cls: 'tasks-view-task-date' });
				el.setText(`⏳ ${formatDate(task.scheduled)}`);
			}

			if (task.due) {
				const isOverdue = task.due < today && !isDone;
				const isDueToday = task.due === today;
				const el = meta.createEl('span', {
					cls: `tasks-view-task-date${isOverdue ? ' is-overdue' : ''}${isDueToday ? ' is-due-today' : ''}`,
				});
				el.setText(`📅 ${formatDate(task.due)}`);
			}

			if (task.recurrence) {
				meta.createEl('span', {
					cls: 'tasks-view-task-recurrence',
					text: `🔁 ${task.recurrence}`,
				});
			}
		}

		// Actions
		const actions = item.createEl('div', { cls: 'tasks-view-task-actions' });

		const sourceBtn = actions.createEl('div', { cls: 'tasks-view-task-action-btn', attr: { 'aria-label': 'Open source' } });
		setIcon(sourceBtn, 'link');
		sourceBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.openSource(task);
		});

		const editBtn = actions.createEl('div', { cls: 'tasks-view-task-action-btn', attr: { 'aria-label': 'Edit task' } });
		setIcon(editBtn, 'pencil');
		editBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			this.openTaskEditor(task);
		});

		// Render bookmark children (display only, no interactions)
		for (const child of task.children) {
			if (child.status === 'bookmark') {
				this.renderBookmark(parent, child, depth + 1);
			} else {
				this.renderTaskItem(parent, child, today, depth + 1);
			}
		}
	}

	private async openSource(task: Task) {
		const existing = this.app.workspace.getLeavesOfType('markdown')
			.find((l) => (l.view as MarkdownView).file?.path === task.file.path);

		const leaf = existing ?? this.app.workspace.getLeaf('tab');
		await leaf.openFile(task.file);
		this.app.workspace.revealLeaf(leaf);

		const view = leaf.view as MarkdownView;
		view.editor.setCursor({ line: task.line, ch: 0 });
		view.editor.scrollIntoView({ from: { line: task.line, ch: 0 }, to: { line: task.line, ch: 0 } }, true);
	}

	private async openTaskEditor(task: Task) {
		const existing = this.app.workspace.getLeavesOfType('markdown')
			.find((l) => (l.view as MarkdownView).file?.path === task.file.path);
		const leaf = existing ?? this.app.workspace.getLeaf('tab');
		await leaf.openFile(task.file);
		this.app.workspace.setActiveLeaf(leaf, { focus: true });

		const view = leaf.view as MarkdownView;
		view.editor.setCursor({ line: task.line, ch: 0 });

		// @ts-expect-error — Tasks plugin internal command
		this.app.commands.executeCommandById('obsidian-tasks-plugin:edit-task');
	}

	private async toggleTask(task: Task, item: HTMLElement, checkInput: HTMLInputElement) {
		// Open the file and move cursor to the task line, then fire the Tasks toggle command
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(task.file);

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;

		const editor = view.editor;
		editor.setCursor({ line: task.line, ch: 0 });

		// @ts-expect-error — Tasks plugin internal command
		this.app.commands.executeCommandById('obsidian-tasks-plugin:toggle-done');

		// Update visuals immediately without waiting for file re-scan
		const nowDone = task.status !== 'done';
		checkInput.checked = nowDone;
		if (nowDone) {
			item.addClass('is-done');
		} else {
			item.removeClass('is-done');
		}
	}

	private renderBookmark(parent: HTMLElement, task: Task, depth: number) {
		const item = parent.createEl('div', { cls: 'tasks-view-bookmark-item' });
		if (depth > 0) item.style.paddingLeft = `${depth * 20 + 12}px`;
		item.createEl('span', { cls: 'tasks-view-bookmark-icon', text: '🔖' });
		item.createEl('span', { cls: 'tasks-view-bookmark-text', text: task.description });
	}

	private renderStats(parent: HTMLElement, allFlat: Task[], today: string) {
		const todayFlat = allFlat.filter(
			(t) => t.status !== 'bookmark' && (t.scheduled === today || t.due === today),
		);
		const done = todayFlat.filter((t) => t.status === 'done').length;
		const pending = todayFlat.filter((t) => t.status !== 'done' && t.status !== 'migrated').length;
		const overdue = allFlat.filter(
			(t) =>
				t.status !== 'done' &&
				t.status !== 'migrated' &&
				t.status !== 'bookmark' &&
				((t.scheduled && t.scheduled < today) || (t.due && t.due < today)),
		).length;

		const total = done + pending;
		const pct = total > 0 ? Math.round((done / total) * 100) : 0;

		const statsEl = parent.createEl('div', { cls: 'tasks-view-stats' });

		const barWrap = statsEl.createEl('div', { cls: 'tasks-view-progress-bar' });
		const fill = barWrap.createEl('div', { cls: 'tasks-view-progress-fill' });
		fill.style.width = `${pct}%`;

		const pills = statsEl.createEl('div', { cls: 'tasks-view-stat-pills' });
		pills.createEl('span', { cls: 'tasks-view-stat-pill', text: `${done} done` });
		pills.createEl('span', { cls: 'tasks-view-stat-pill', text: `${pending} pending` });
		pills.createEl('span', { cls: `tasks-view-stat-pill${overdue > 0 ? ' is-overdue' : ''}`, text: `${overdue} overdue` });
	}

	private renderPlaceholder(message: string) {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('tasks-view-container');
		const placeholder = container.createEl('div', { cls: 'tasks-view-placeholder' });
		const iconEl = placeholder.createEl('div', { cls: 'tasks-view-placeholder-icon' });
		setIcon(iconEl, 'checkmark');
		placeholder.createEl('p', { text: 'Obsidian Task Views' });
		placeholder.createEl('p', { text: message, cls: 'tasks-view-placeholder-sub' });
	}
}
