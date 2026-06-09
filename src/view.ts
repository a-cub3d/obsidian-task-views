import { ItemView, MarkdownRenderer, MarkdownView, TFile, WorkspaceLeaf, setIcon } from 'obsidian';
import type TaskViewsPlugin from './main';
import { scanVault, Task } from './parser';

export const VIEW_TYPE_TASKS_SIDEBAR = 'tasks-companion-pane-sidebar';

type TabId = 'today' | 'tomorrow' | 'backlog';

function getToday(): string {
	const d = new Date();
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

export class TasksSidebarView extends ItemView {
	private plugin: TaskViewsPlugin;
	private allTasks: Task[] = [];
	private activeTab: TabId = 'today';

	// Tab elements
	private tabBtns: Record<TabId, HTMLElement> = {} as Record<TabId, HTMLElement>;
	private tabPanels: Record<TabId, HTMLElement> = {} as Record<TabId, HTMLElement>;

	// Today tab section elements
	private overdueSection: HTMLElement | null = null;
	private overdueBody: HTMLElement | null = null;
	private overdueCount: HTMLElement | null = null;
	private overdueChevron: HTMLElement | null = null;
	private overdueCollapsed = true;

	private todayBody: HTMLElement | null = null;
	private todayCount: HTMLElement | null = null;

	// Tomorrow tab
	private tomorrowBody: HTMLElement | null = null;
	private tomorrowCount: HTMLElement | null = null;

	// Backlog tab
	private backlogBody: HTMLElement | null = null;
	private backlogCount: HTMLElement | null = null;

	// Stats elements
	private progressFill: HTMLElement | null = null;
	private pillDone: HTMLElement | null = null;
	private pillPending: HTMLElement | null = null;
	private pillOverdue: HTMLElement | null = null;
	private pillInProgress: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TaskViewsPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string { return VIEW_TYPE_TASKS_SIDEBAR; }
	getDisplayText(): string { return 'Tasks'; }
	getIcon(): string { return 'checkmark'; }

	async onOpen(): Promise<void> {
		this.addAction('settings', 'Task Views settings', () => {
			// @ts-expect-error — internal settings API
			this.app.setting.open();
			// @ts-expect-error — internal settings API
			this.app.setting.openTabById('tasks-companion-pane');
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
		this.renderTabs(container);
		this.buildStatsShell(container);
	}

	private renderTabs(container: HTMLElement) {
		// Tab bar
		const tabBar = container.createEl('div', { cls: 'tasks-view-tab-bar' });
		const segment = tabBar.createEl('div', { cls: 'tasks-view-tab-segment' });
		const tabs: { id: TabId; label: string }[] = [
			{ id: 'today', label: 'Today' },
			{ id: 'tomorrow', label: 'Tomorrow' },
			{ id: 'backlog', label: 'Backlog' },
		];

		for (const { id, label } of tabs) {
			const btn = segment.createEl('button', { cls: 'tasks-view-tab-btn', text: label });
			if (id === this.activeTab) btn.addClass('is-active');
			btn.addEventListener('click', () => this.switchTab(id));
			this.tabBtns[id] = btn;
		}

		// Tab panels (scroll area per tab)
		const panelWrap = container.createEl('div', { cls: 'tasks-view-tab-panels' });

		// Today panel
		const todayPanel = panelWrap.createEl('div', { cls: 'tasks-view-tab-panel tasks-view-scroll' });
		if (this.activeTab !== 'today') todayPanel.addClass('is-hidden');
		this.tabPanels['today'] = todayPanel;
		this.buildTodayPanel(todayPanel);

		// Tomorrow panel
		const tomorrowPanel = panelWrap.createEl('div', { cls: 'tasks-view-tab-panel tasks-view-scroll' });
		if (this.activeTab !== 'tomorrow') tomorrowPanel.addClass('is-hidden');
		this.tabPanels['tomorrow'] = tomorrowPanel;
		this.buildSimplePanel(tomorrowPanel, 'tomorrow');

		// Backlog panel
		const backlogPanel = panelWrap.createEl('div', { cls: 'tasks-view-tab-panel tasks-view-scroll' });
		if (this.activeTab !== 'backlog') backlogPanel.addClass('is-hidden');
		this.tabPanels['backlog'] = backlogPanel;
		this.buildSimplePanel(backlogPanel, 'backlog');
	}

	private buildTodayPanel(panel: HTMLElement) {
		// Overdue section — starts visible so Tasks can render into it, hidden after count check
		this.overdueSection = panel.createEl('div', { cls: 'tasks-view-section tasks-view-section--overdue' });

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
		const todaySection = panel.createEl('div', { cls: 'tasks-view-section' });

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
	}

	private buildSimplePanel(panel: HTMLElement, which: 'tomorrow' | 'backlog') {
		const section = panel.createEl('div', { cls: 'tasks-view-section' });
		const header = section.createEl('div', { cls: 'tasks-view-section-header' });
		const chevron = header.createEl('div', { cls: 'tasks-view-section-chevron' });
		setIcon(chevron, 'chevron-down');
		const label = which === 'tomorrow' ? 'Tomorrow' : 'Backlog';
		header.createEl('span', { cls: 'tasks-view-section-title', text: label });
		const count = header.createEl('span', { cls: 'tasks-view-section-count', text: '0' });
		const body = section.createEl('div', { cls: 'tasks-view-section-body' });

		if (which === 'tomorrow') {
			this.tomorrowBody = body;
			this.tomorrowCount = count;
		} else {
			this.backlogBody = body;
			this.backlogCount = count;
		}

		let collapsed = false;
		header.addEventListener('click', () => {
			collapsed = !collapsed;
			body.toggleClass('is-collapsed', collapsed);
			setIcon(chevron, collapsed ? 'chevron-right' : 'chevron-down');
		});
	}

	private switchTab(id: TabId) {
		if (id === this.activeTab) return;
		this.tabBtns[this.activeTab].removeClass('is-active');
		this.tabPanels[this.activeTab].addClass('is-hidden');
		this.activeTab = id;
		this.tabBtns[id].addClass('is-active');
		this.tabPanels[id].removeClass('is-hidden');
	}

	// ── Refresh (re-runs on every file change) ──────────

	async refresh() {
		const today = getToday();
		this.allTasks = await scanVault(this.app, this.plugin.settings);
		this.updateStats(today);
		await this.renderQueries();
	}

	private async renderQueries() {
		const { todayQuery, overdueQuery, tomorrowQuery, backlogQuery } = this.plugin.settings;

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
		}

		if (this.tomorrowBody) {
			this.tomorrowBody.empty();
			await MarkdownRenderer.render(
				this.app,
				'```tasks\n' + tomorrowQuery + '\n```',
				this.tomorrowBody,
				'',
				this,
			);
			this.interceptLinks(this.tomorrowBody);
		}

		if (this.backlogBody) {
			this.backlogBody.empty();
			await MarkdownRenderer.render(
				this.app,
				'```tasks\n' + backlogQuery + '\n```',
				this.backlogBody,
				'',
				this,
			);
			this.interceptLinks(this.backlogBody);
		}

		setTimeout(() => this.updateCounts(), 600);
	}

	private updateCounts() {
		const today = getToday();
		const flatten = (tasks: Task[]): Task[] =>
			tasks.flatMap((t) => [t, ...flatten(t.children)]);
		const flat = flatten(this.allTasks);

		// Today count
		const todayCount = flat.filter(
			(t) =>
				t.status !== 'bookmark' &&
				t.status !== 'migrated' &&
				(t.scheduled === today || t.due === today),
		).length;
		if (this.todayCount) this.todayCount.setText(String(todayCount));

		// Overdue count — also controls section visibility
		const overdueCount = flat.filter(
			(t) =>
				t.status !== 'done' &&
				t.status !== 'migrated' &&
				t.status !== 'bookmark' &&
				((t.scheduled && t.scheduled < today) || (t.due && t.due < today)),
		).length;
		if (this.overdueSection) {
			this.overdueSection.style.display = overdueCount > 0 ? '' : 'none';
		}
		if (this.overdueCount) this.overdueCount.setText(String(overdueCount));

		// Tomorrow count
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		const ty = tomorrow.getFullYear();
		const tm = String(tomorrow.getMonth() + 1).padStart(2, '0');
		const td = String(tomorrow.getDate()).padStart(2, '0');
		const tomorrowStr = `${ty}-${tm}-${td}`;
		const tomorrowCount = flat.filter(
			(t) =>
				t.status !== 'bookmark' &&
				t.status !== 'migrated' &&
				t.status !== 'done' &&
				(t.scheduled === tomorrowStr || t.due === tomorrowStr),
		).length;
		if (this.tomorrowCount) this.tomorrowCount.setText(String(tomorrowCount));

		// Backlog count — no scheduled or due date, not done
		const backlogCount = flat.filter(
			(t) =>
				t.status !== 'bookmark' &&
				t.status !== 'migrated' &&
				t.status !== 'done' &&
				!t.scheduled &&
				!t.due,
		).length;
		if (this.backlogCount) this.backlogCount.setText(String(backlogCount));
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

		const topRow = wrap.createEl('div', { cls: 'tasks-view-quick-add-top' });
		const input = topRow.createEl('input', {
			cls: 'tasks-view-quick-add-input',
			attr: { placeholder: 'Add to inbox…', type: 'text' },
		}) as HTMLInputElement;

		const settingsBtn = topRow.createEl('button', {
			cls: 'tasks-view-settings-btn',
			attr: { 'aria-label': 'Task Views settings' },
		});
		setIcon(settingsBtn, 'settings');
		settingsBtn.addEventListener('click', () => {
			// @ts-expect-error — accessing internal settings API
			this.app.setting.open();
			// @ts-expect-error — accessing internal settings API
			this.app.setting.openTabById('tasks-companion-pane');
		});

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
		this.pillDone = pills.createEl('span', { cls: 'tasks-view-stat-pill tasks-view-stat-pill--done', text: '0 done' });
		this.pillInProgress = pills.createEl('span', { cls: 'tasks-view-stat-pill tasks-view-stat-pill--in-progress', text: '0 in progress' });
		this.pillPending = pills.createEl('span', { cls: 'tasks-view-stat-pill tasks-view-stat-pill--pending', text: '0 pending' });
		this.pillOverdue = pills.createEl('span', { cls: 'tasks-view-stat-pill tasks-view-stat-pill--overdue', text: '0 overdue' });
	}

	private updateStats(today: string) {
		const flatten = (tasks: Task[]): Task[] =>
			tasks.flatMap((t) => [t, ...flatten(t.children)]);
		const flat = flatten(this.allTasks);

		// Active set = tasks due/scheduled today or overdue (the day's workload)
		const activeSet = flat.filter(
			(t) =>
				t.status !== 'bookmark' &&
				t.status !== 'migrated' &&
				t.status !== 'done' &&
				((t.scheduled && t.scheduled <= today) || (t.due && t.due <= today)),
		);

		const done = flat.filter(
			(t) => t.status === 'done' && t.completionDate === today,
		).length;
		const inProgress = activeSet.filter((t) => t.status === 'in-progress').length;
		const pending = activeSet.length;
		const overdue = activeSet.filter(
			(t) =>
				(t.scheduled && t.scheduled < today) || (t.due && t.due < today),
		).length;

		const total = done + pending;
		const progress = done + inProgress * 0.5;
		const pct = total > 0 ? Math.round((progress / total) * 100) : 0;

		if (this.progressFill) this.progressFill.style.width = `${pct}%`;
		if (this.pillDone) this.pillDone.setText(`${done} done`);
		if (this.pillInProgress) this.pillInProgress.setText(`${inProgress} in progress`);
		if (this.pillPending) this.pillPending.setText(`${pending} pending`);
		if (this.pillOverdue) this.pillOverdue.setText(`${overdue} overdue`);
	}
}
