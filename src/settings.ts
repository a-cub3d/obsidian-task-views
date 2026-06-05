import { App, PluginSettingTab, Setting } from 'obsidian';
import type TaskViewsPlugin from './main';

export const DEFAULT_TODAY_QUERY = `(scheduled on today) OR (due on today)
group by filename
sort by scheduled
sort by due`;

export const DEFAULT_OVERDUE_QUERY = `not done
(scheduled before today) OR (due before today)
group by filename
sort by scheduled
sort by due`;

export const DEFAULT_TOMORROW_QUERY = `not done
(scheduled on tomorrow) OR (due on tomorrow)
group by filename
sort by scheduled
sort by due`;

export const DEFAULT_BACKLOG_QUERY = `not done
no scheduled date
no due date
group by filename
sort by created`;

export interface TaskViewsSettings {
	inboxFilePath: string;
	excludedFolders: string;
	todayQuery: string;
	overdueQuery: string;
	tomorrowQuery: string;
	backlogQuery: string;
}

export const DEFAULT_SETTINGS: TaskViewsSettings = {
	inboxFilePath: 'Inbox.md',
	excludedFolders: 'System/Templates',
	todayQuery: DEFAULT_TODAY_QUERY,
	overdueQuery: DEFAULT_OVERDUE_QUERY,
	tomorrowQuery: DEFAULT_TOMORROW_QUERY,
	backlogQuery: DEFAULT_BACKLOG_QUERY,
};

export class TaskViewsSettingTab extends PluginSettingTab {
	plugin: TaskViewsPlugin;

	constructor(app: App, plugin: TaskViewsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// ── Quick Add ──────────────────────────────────────
		containerEl.createEl('h3', { text: 'Quick Add', cls: 'tasks-view-settings-heading' });

		new Setting(containerEl)
			.setName('Inbox file path')
			.setDesc('File that quick-add writes new tasks to.')
			.addText((text) =>
				text
					.setPlaceholder('Inbox.md')
					.setValue(this.plugin.settings.inboxFilePath)
					.onChange(async (value) => {
						this.plugin.settings.inboxFilePath = value;
						await this.plugin.saveSettings();
					}),
			);

		// ── Excluded folders ───────────────────────────────
		containerEl.createEl('h3', { text: 'Excluded Folders', cls: 'tasks-view-settings-heading' });
		containerEl.createEl('p', {
			text: 'Folders to skip during vault scan. Subfolders are also excluded.',
			cls: 'setting-item-description',
		});

		this.renderExcludedFolders(containerEl);

		// ── Queries ────────────────────────────────────────
		containerEl.createEl('h3', { text: 'Queries', cls: 'tasks-view-settings-heading' });
		containerEl.createEl('p', {
			text: 'Standard Tasks plugin query syntax. Changes take effect when you click Apply.',
			cls: 'setting-item-description',
		});

		new Setting(containerEl)
			.setName('Today query')
			.setDesc('Tasks shown in the Today section.')
			.addTextArea((text) => {
				text
					.setPlaceholder(DEFAULT_TODAY_QUERY)
					.setValue(this.plugin.settings.todayQuery)
					.onChange((value) => {
						this.plugin.settings.todayQuery = value;
					});
				text.inputEl.rows = 6;
				text.inputEl.style.width = '340px';
				text.inputEl.style.fontFamily = 'var(--font-monospace)';
				text.inputEl.style.fontSize = 'var(--font-ui-smaller)';
				text.inputEl.style.resize = 'vertical';
			})
			.addButton((btn) =>
				btn
					.setButtonText('Apply')
					.setCta()
					.onClick(async () => {
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Overdue query')
			.setDesc('Tasks shown in the Overdue section of the Today tab. Section is hidden if query returns no results.')
			.addTextArea((text) => {
				text
					.setPlaceholder(DEFAULT_OVERDUE_QUERY)
					.setValue(this.plugin.settings.overdueQuery)
					.onChange((value) => {
						this.plugin.settings.overdueQuery = value;
					});
				text.inputEl.rows = 6;
				text.inputEl.style.width = '340px';
				text.inputEl.style.fontFamily = 'var(--font-monospace)';
				text.inputEl.style.fontSize = 'var(--font-ui-smaller)';
				text.inputEl.style.resize = 'vertical';
			})
			.addButton((btn) =>
				btn
					.setButtonText('Apply')
					.setCta()
					.onClick(async () => {
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Tomorrow query')
			.setDesc('Tasks shown in the Tomorrow tab.')
			.addTextArea((text) => {
				text
					.setPlaceholder(DEFAULT_TOMORROW_QUERY)
					.setValue(this.plugin.settings.tomorrowQuery)
					.onChange((value) => {
						this.plugin.settings.tomorrowQuery = value;
					});
				text.inputEl.rows = 6;
				text.inputEl.style.width = '340px';
				text.inputEl.style.fontFamily = 'var(--font-monospace)';
				text.inputEl.style.fontSize = 'var(--font-ui-smaller)';
				text.inputEl.style.resize = 'vertical';
			})
			.addButton((btn) =>
				btn
					.setButtonText('Apply')
					.setCta()
					.onClick(async () => {
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Backlog query')
			.setDesc('Tasks shown in the Backlog tab.')
			.addTextArea((text) => {
				text
					.setPlaceholder(DEFAULT_BACKLOG_QUERY)
					.setValue(this.plugin.settings.backlogQuery)
					.onChange((value) => {
						this.plugin.settings.backlogQuery = value;
					});
				text.inputEl.rows = 6;
				text.inputEl.style.width = '340px';
				text.inputEl.style.fontFamily = 'var(--font-monospace)';
				text.inputEl.style.fontSize = 'var(--font-ui-smaller)';
				text.inputEl.style.resize = 'vertical';
			})
			.addButton((btn) =>
				btn
					.setButtonText('Apply')
					.setCta()
					.onClick(async () => {
						await this.plugin.saveSettings();
					}),
			);
	}

	private renderExcludedFolders(containerEl: HTMLElement) {
		const getFolders = () =>
			this.plugin.settings.excludedFolders
				.split(',')
				.map((f) => f.trim())
				.filter((f) => f.length > 0);

		const saveFolders = async (folders: string[]) => {
			this.plugin.settings.excludedFolders = folders.join(', ');
			await this.plugin.saveSettings();
		};

		// Chip list
		const chipList = containerEl.createEl('div', { cls: 'tasks-view-excluded-chips' });

		const renderChips = () => {
			chipList.empty();
			for (const folder of getFolders()) {
				const chip = chipList.createEl('div', { cls: 'tasks-view-excluded-chip' });
				chip.createEl('span', { text: folder });
				const removeBtn = chip.createEl('button', { text: '×', cls: 'tasks-view-excluded-chip-remove' });
				removeBtn.addEventListener('click', async () => {
					await saveFolders(getFolders().filter((f) => f !== folder));
					renderChips();
				});
			}
		};

		renderChips();

		// Add row
		const addRow = containerEl.createEl('div', { cls: 'tasks-view-excluded-add' });
		const input = addRow.createEl('input', {
			cls: 'tasks-view-excluded-input',
			attr: { type: 'text', placeholder: 'e.g. System/Templates' },
		}) as HTMLInputElement;
		const addBtn = addRow.createEl('button', { text: 'Add', cls: 'tasks-view-excluded-add-btn' });

		const addFolder = async () => {
			const val = input.value.trim();
			if (!val) return;
			const current = getFolders();
			if (!current.includes(val)) {
				await saveFolders([...current, val]);
				renderChips();
			}
			input.value = '';
		};

		addBtn.addEventListener('click', addFolder);
		input.addEventListener('keydown', (e) => { if (e.key === 'Enter') addFolder(); });
	}
}
