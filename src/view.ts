import { ItemView, MarkdownRenderer, MarkdownView, TFile, WorkspaceLeaf, setIcon } from 'obsidian';
import type TaskViewsPlugin from './main';
import { scanVault, Task } from './parser';

export const VIEW_TYPE_TASKS_SIDEBAR = 'tasks-view-sidebar';

function getToday(): string {
	return new Date().toISOString().split('T')[0] as string;
}

export class TasksSidebarView extends ItemView {
	private plugin: TaskViewsPlugin;
	private allTasks: Task[] = [];

	// Section elements
	private overdueSection: HTMLElement | null = null;
	private overdueBody: HTMLElement | null = null;
	private overdueCount: HTMLElement | null = null;
	private overdueChevron: HTMLElement | null = null;
	private overdueCollapsed = true;

	private todayBody: HTMLElement | null = null;
	private todayCount: HTMLElement | null = null;

	// Stats elements
	private progressFill: HTMLElement | null = null;
	private pillDone: HTMLElement | null = null;
	private pillPending: HTMLElement | null = null;
	private pillOverdue: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TaskViewsPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string { return VIEW_TYPE_TASKS_SIDEBAR; }
	getDisplayText(): string { return 'Tasks'; }
	getIcon(): string { return 'checkmark'; }

	async onOpen(): Promise<void> {
		// Gear icon in the title bar
		this.addAction('settings', 'Tasks View settings', () => {
			// @ts-expect-error — accessing internal settings API
			this.app.setting.openTabById('obsidian-task-views');
		});

		this.buildShell();
		await this.refresh();
		this.registerVaultWatcher();
	}

	async onClose(): Promise<void> {}

	// ── Shell (built once) ──────────────────────────────

	private buildShell() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('tasks-view-container');

		this.renderQuickAdd(container);

		const scroll = container.createEl('div', { cls: 'tasks-view-scroll' });

		// Overdue section (hidden until we know there are overdue tasks)
		this.overdueSection = scroll.createEl('div', { cls: 'tasks-view-section tasks-view-section--overdue' });
		this.overdueSection.style.display = 'none';

		const overdueHeader = this.overdueSection.createEl('div', { cls: 'tasks-view-section-header' });
		this.overdueChevron = overdueHeader.createEl('div', { cls: 'tasks-view-section-chevron' });
		setIcon(this.overdueChevron, 'chevron-right');
		overdueHeader.createEl('span', { cls: 'tasks-view-section-title', text: 'Overdue' });
		this.overdueCount = overdueHeader.createEl('span', { cls: 'tasks-view-section-count', text: '0' });

		this.overdueBody = this.overdueSection.createEl('div', { cls: 'tasks-view-section-body is-collapsed' });

		overdueHeader.addEventListener('click', () => {
			this.overdueCollapsed = !this.overdueCollapsed;
			this.overdueBody?.toggleClass('is-collapsed', this.overdueCollapsed);
			if (this.overdueChevron) setIcon(this.overdueChevron, this.overdueCollapsed ? 'chevron-right' : 'chevron-down');
		});

		// Today section
		const todaySection = scroll.createEl('div', { cls: 'tasks-view-section' });

		const todayHeader = todaySection.createEl('div', { cls: 'tasks-view-section-header' });
		const todayChevron = todayHeader.createEl('div', { cls: 'tasks-view-section-chevron' });
		setIcon(todayChevron, 'chevron-down');
		todayHeader.createEl('span', { cls: 'tasks-view-section-title', text: 'Today' });
		this.todayCount = todayHeader.createEl('span', { cls: 'tasks-view-section-count', text: '0' });

		this.todayBody = todaySection.createEl('div', { cls: 'tasks-view-section-body' });

		let todayCollapsed = false;
		todayHeader.addEventListener('click', () => {
			todayCollapsed = !todayCollapsed;
			this.todayBody?.toggleClass('is-collapsed', todayCollapsed);
			setIcon(todayChevron, todayCollapsed ? 'chevron-right' : 'chevron-down');
		});

		this.buildStatsShell(container);
	}

	// ── Refresh (re-runs on every file change) ──────────

	async refresh() {
		const today = getToday();
		this.allTasks = await scanVault(this.app, this.plugin.settings);
		this.updateStats(today);
		await this.renderQueries();
	}

	private async renderQueries() {
		const { todayQuery, overdueQuery } = this.plugin.settings;

		// Today
		if (this.todayBody) {
			this.todayBody.empty();
			await MarkdownRenderer.render(
				this.app,
				'```tasks\n' + todayQuery + '\n```',
				this.todayBody,
				'',
				this,
			);
			this.interceptLinks(this.todayBody);
		}

		// Overdue — render then check if any tasks came back
		if (this.overdueBody && this.overdueSection) {
			this.overdueBody.empty();
			await MarkdownRenderer.render(
				this.app,
				'```tasks\n' + overdueQuery + '\n```',
				this.overdueBody,
				'',
				this,
			);
			this.interceptLinks(this.overdueBody);

			// Hide the overdue section if query returned no tasks
			const taskCount = this.getRenderedTaskCount(this.overdueBody);
			this.overdueSection.style.display = taskCount > 0 ? '' : 'none';
			if (this.overdueCount) this.overdueCount.setText(String(taskCount));
		}

		// Update today count from rendered output
		if (this.todayBody && this.todayCount) {
			const count = this.getRenderedTaskCount(this.todayBody);
			this.todayCount.setText(String(count));
		}
	}

	// Count tasks from rendered Tasks output by looking for task list items
	private getRenderedTaskCount(container: HTMLElement): number {
		return container.querySelectorAll('.tasks-list-text').length;
	}

	// ── Link interception ───────────────────────────────

	private interceptLinks(container: HTMLElement) {
		container.addEventListener('click', (e) => {
			const target = e.target as HTMLElement;
			const link = target.closest('a.internal-link') as HTMLAnchorElement | null;
			if (!link) return;

			const href = link.getAttribute('href') || link.getAttribute('data-href');
			if (!href) return;

			e.preventDefault();
			e.stopPropagation();

			const file = this.app.metadataCache.getFirstLinkpathDest(href, '');
			if (!file) return;

			const existing = this.app.workspace.getLeavesOfType('markdown')
				.find((l) => (l.view as MarkdownView).file?.path === file.path);
			const leaf = existing ?? this.app.workspace.getLeaf('tab');
			leaf.openFile(file);
			this.app.workspace.revealLeaf(leaf);
		});
	}

	// ── Vault watcher ───────────────────────────────────

	private registerVaultWatcher() {
		let debounceTimer: ReturnType<typeof setTimeout> | null = null;
		this.registerEvent(
			this.app.vault.on('modify', async (file) => {
				if (!(file instanceof TFile) || file.extension !== 'md') return;
				if (debounceTimer) clearTimeout(debounceTimer);
				debounceTimer = setTimeout(() => this.refresh(), 400);
			}),
		);
	}

	// ── Quick add ───────────────────────────────────────

	private renderQuickAdd(container: HTMLElement) {
		const wrap = container.createEl('div', { cls: 'tasks-view-quick-add' });
		const input = wrap.createEl('input', {
			cls: 'tasks-view-quick-add-input',
			attr: { placeholder: 'Add to inbox…', type: 'text' },
		}) as HTMLInputElement;

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
		if (!file) file = await vault.create(inboxFilePath, '');
		const existing = await vault.read(file);
		const newLine = `- [ ] ${text}`;
		const updated = existing.endsWith('\n') || existing === ''
			? existing + newLine + '\n'
			: existing + '\n' + newLine + '\n';
		await vault.modify(file, updated);
	}

	// ── Stats ───────────────────────────────────────────

	private buildStatsShell(container: HTMLElement) {
		const statsEl = container.createEl('div', { cls: 'tasks-view-stats' });
		const barWrap = statsEl.createEl('div', { cls: 'tasks-view-progress-bar' });
		this.progressFill = barWrap.createEl('div', { cls: 'tasks-view-progress-fill' });
		this.progressFill.style.width = '0%';
		const pills = statsEl.createEl('div', { cls: 'tasks-view-stat-pills' });
		this.pillDone = pills.createEl('span', { cls: 'tasks-view-stat-pill', text: '0 done' });
		this.pillPending = pills.createEl('span', { cls: 'tasks-view-stat-pill', text: '0 pending' });
		this.pillOverdue = pills.createEl('span', { cls: 'tasks-view-stat-pill', text: '0 overdue' });
	}

	private updateStats(today: string) {
		const flatten = (tasks: Task[]): Task[] =>
			tasks.flatMap((t) => [t, ...flatten(t.children)]);
		const flat = flatten(this.allTasks);

		const todayFlat = flat.filter(
			(t) => t.status !== 'bookmark' && (t.scheduled === today || t.due === today),
		);
		const done = todayFlat.filter((t) => t.status === 'done').length;
		const inProgress = todayFlat.filter((t) => t.status === 'in-progress').length;
		const pending = todayFlat.filter((t) => t.status !== 'done' && t.status !== 'migrated').length;
		const overdue = flat.filter(
			(t) =>
				t.status !== 'done' &&
				t.status !== 'migrated' &&
				t.status !== 'bookmark' &&
				((t.scheduled && t.scheduled < today) || (t.due && t.due < today)),
		).length;

		const total = done + pending;
		const progress = done + inProgress * 0.5;
		const pct = total > 0 ? Math.round((progress / total) * 100) : 0;

		if (this.progressFill) this.progressFill.style.width = `${pct}%`;
		if (this.pillDone) this.pillDone.setText(`${done} done`);
		if (this.pillPending) this.pillPending.setText(`${pending} pending`);
		if (this.pillOverdue) {
			this.pillOverdue.setText(`${overdue} overdue`);
			this.pillOverdue.toggleClass('is-overdue', overdue > 0);
		}
	}
}
