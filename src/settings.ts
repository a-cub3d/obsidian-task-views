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

export interface TaskViewsSettings {
	inboxFilePath: string;
	excludedFolders: string;
	todayQuery: string;
	overdueQuery: string;
}

export const DEFAULT_SETTINGS: TaskViewsSettings = {
	inboxFilePath: 'Inbox.md',
	excludedFolders: 'System/Templates',
	todayQuery: DEFAULT_TODAY_QUERY,
	overdueQuery: DEFAULT_OVERDUE_QUERY,
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
		containerEl.createEl('h2', { text: 'Obsidian Task Views' });

		// ── Inbox ──────────────────────────────────────────
		containerEl.createEl('h3', { text: 'Quick Add' });

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

		new Setting(containerEl)
			.setName('Excluded folders')
			.setDesc('Comma-separated folder paths to skip during vault scan.')
			.addText((text) =>
				text
					.setPlaceholder('System/Templates')
					.setValue(this.plugin.settings.excludedFolders)
					.onChange(async (value) => {
						this.plugin.settings.excludedFolders = value;
						await this.plugin.saveSettings();
					}),
			);

		// ── Queries ────────────────────────────────────────
		containerEl.createEl('h3', { text: 'Queries' });
		containerEl.createEl('p', {
			text: 'These are standard Tasks plugin query syntax. Changes take effect immediately when saved.',
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
				text.inputEl.rows = 5;
				text.inputEl.style.width = '100%';
				text.inputEl.style.fontFamily = 'var(--font-monospace)';
				text.inputEl.style.fontSize = 'var(--font-ui-smaller)';
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
			.setDesc('Tasks shown in the Overdue section. Section is hidden if query returns no results.')
			.addTextArea((text) => {
				text
					.setPlaceholder(DEFAULT_OVERDUE_QUERY)
					.setValue(this.plugin.settings.overdueQuery)
					.onChange((value) => {
						this.plugin.settings.overdueQuery = value;
					});
				text.inputEl.rows = 5;
				text.inputEl.style.width = '100%';
				text.inputEl.style.fontFamily = 'var(--font-monospace)';
				text.inputEl.style.fontSize = 'var(--font-ui-smaller)';
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
}
