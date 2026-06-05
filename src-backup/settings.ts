import { App, PluginSettingTab, Setting } from 'obsidian';
import type TaskViewsPlugin from './main';

export interface TaskViewsSettings {
	inboxFilePath: string;
	excludedFolders: string;
	groupBy: 'note' | 'heading';
	showCompleted: boolean;
	showMigrated: boolean;
	defaultDateField: 'scheduled' | 'due';
}

export const DEFAULT_SETTINGS: TaskViewsSettings = {
	inboxFilePath: 'Inbox.md',
	excludedFolders: 'System/Templates',
	groupBy: 'note',
	showCompleted: true,
	showMigrated: false,
	defaultDateField: 'scheduled',
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

		new Setting(containerEl)
			.setName('Group by')
			.setDesc('How to group tasks in the sidebar.')
			.addDropdown((drop) =>
				drop
					.addOption('note', 'Note')
					.addOption('heading', 'Heading')
					.setValue(this.plugin.settings.groupBy)
					.onChange(async (value) => {
						this.plugin.settings.groupBy = value as 'note' | 'heading';
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Show completed tasks')
			.setDesc('Show done tasks inline with strikethrough.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showCompleted)
					.onChange(async (value) => {
						this.plugin.settings.showCompleted = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Show migrated tasks')
			.setDesc('Show [>] migrated tasks (off = hide entirely).')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showMigrated)
					.onChange(async (value) => {
						this.plugin.settings.showMigrated = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Default date field')
			.setDesc('Which date field controls sort order.')
			.addDropdown((drop) =>
				drop
					.addOption('scheduled', 'Scheduled')
					.addOption('due', 'Due')
					.setValue(this.plugin.settings.defaultDateField)
					.onChange(async (value) => {
						this.plugin.settings.defaultDateField = value as 'scheduled' | 'due';
						await this.plugin.saveSettings();
					}),
			);
	}
}
