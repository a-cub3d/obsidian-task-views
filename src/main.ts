import { Notice, Plugin } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	TaskViewsSettings,
	TaskViewsSettingTab,
} from './settings';
import { TasksSidebarView, VIEW_TYPE_TASKS_SIDEBAR } from './view';

export default class TaskViewsPlugin extends Plugin {
	settings!: TaskViewsSettings;

	async onload() {
		await this.loadSettings();

		if (!this.hasTasksPlugin()) {
			new Notice(
				'Obsidian Task Views: The Tasks plugin (obsidian-tasks-group) must be installed and enabled.',
				10000,
			);
			return;
		}

		this.registerView(
			VIEW_TYPE_TASKS_SIDEBAR,
			(leaf) => new TasksSidebarView(leaf, this),
		);

		this.addCommand({
			id: 'open-tasks-sidebar',
			name: 'Open Tasks sidebar',
			callback: () => this.activateSidebarView(),
		});

		this.addSettingTab(new TaskViewsSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			this.activateSidebarView();
		});
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_TASKS_SIDEBAR);
	}

	private hasTasksPlugin(): boolean {
		// @ts-expect-error — accessing community plugin registry
		return !!this.app.plugins.plugins['obsidian-tasks-plugin'];
	}

	private async activateSidebarView() {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_TASKS_SIDEBAR);
		const existingLeaf = existing[0];
		if (existingLeaf) {
			this.app.workspace.revealLeaf(existingLeaf);
			return;
		}
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({ type: VIEW_TYPE_TASKS_SIDEBAR, active: true });
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<TaskViewsSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
