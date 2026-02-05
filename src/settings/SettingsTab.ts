import { App, PluginSettingTab, Setting } from 'obsidian';
import TimelineGanttPlugin from '../../main';

export interface TimelineGanttSettings {
	projectsFilePath: string;
	defaultZoomLevel: 'day' | 'week' | 'month';
	showWeekends: boolean;
	showTodayLine: boolean;
	autoRefresh: boolean;
	taskBarHeight: number;
	rowHeight: number;
	showDragHandles: boolean;
	labelColumnWidth: number;
}

export const DEFAULT_SETTINGS: TimelineGanttSettings = {
	projectsFilePath: 'Projects.md',
	defaultZoomLevel: 'day',
	showWeekends: true,
	showTodayLine: true,
	autoRefresh: true,
	taskBarHeight: 28,
	rowHeight: 40,
	showDragHandles: false,
	labelColumnWidth: 280,
};

export class TimelineGanttSettingsTab extends PluginSettingTab {
	plugin: TimelineGanttPlugin;

	constructor(app: App, plugin: TimelineGanttPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Projects file path')
			.setDesc('Path to the Markdown file containing your projects (relative to vault root)')
			.addText((text) =>
				text
					.setPlaceholder('Projects.md')
					.setValue(this.plugin.settings.projectsFilePath)
					.onChange((value) => {
						this.plugin.settings.projectsFilePath = value;
						void this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Default zoom level')
			.setDesc('Initial zoom level when opening the timeline')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('day', 'Days')
					.addOption('week', 'Weeks')
					.addOption('month', 'Months')
					.setValue(this.plugin.settings.defaultZoomLevel)
					.onChange((value: 'day' | 'week' | 'month') => {
						this.plugin.settings.defaultZoomLevel = value;
						void this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Show weekends')
			.setDesc('Highlight weekend days in the timeline')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showWeekends)
					.onChange((value) => {
						this.plugin.settings.showWeekends = value;
						void this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Show today line')
			.setDesc('Display a vertical line indicating the current date')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showTodayLine)
					.onChange((value) => {
						this.plugin.settings.showTodayLine = value;
						void this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Auto-refresh')
			.setDesc('Automatically refresh the timeline when the projects file changes')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoRefresh)
					.onChange((value) => {
						this.plugin.settings.autoRefresh = value;
						void this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Appearance')
			.setHeading();

		new Setting(containerEl)
			.setName('Task bar height')
			.setDesc('Height of task bars in pixels')
			.addSlider((slider) =>
				slider
					.setLimits(20, 50, 2)
					.setValue(this.plugin.settings.taskBarHeight)
					.setDynamicTooltip()
					.onChange((value) => {
						this.plugin.settings.taskBarHeight = value;
						void this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Row height')
			.setDesc('Height of each row in pixels')
			.addSlider((slider) =>
				slider
					.setLimits(30, 60, 2)
					.setValue(this.plugin.settings.rowHeight)
					.setDynamicTooltip()
					.onChange((value) => {
						this.plugin.settings.rowHeight = value;
						void this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Show drag handles')
			.setDesc('Show the drag handle icons (☰). Drag and drop still works when hidden.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showDragHandles)
					.onChange((value) => {
						this.plugin.settings.showDragHandles = value;
						void this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Label column width')
			.setDesc('Width of the task/project name column in pixels (default: 250)')
			.addSlider((slider) =>
				slider
					.setLimits(150, 500, 10)
					.setValue(this.plugin.settings.labelColumnWidth)
					.setDynamicTooltip()
					.onChange((value) => {
						this.plugin.settings.labelColumnWidth = value;
						void this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Syntax reference')
			.setHeading();

		const syntaxHelp = containerEl.createDiv({ cls: 'setting-item-description' });
		const pre = syntaxHelp.createEl('pre', { cls: 'syntax-reference-pre' });
		pre.textContent = `# project title
@start: 2025-02-01

## project name
> task name (5)                  # 5 days duration
> task 2 (3) @after:1            # depends on task 1
>> subtask (2)                   # child task (sequential by default)
> with date (3) @start:2025-03-01  # custom start date
> milestone (1) @milestone
> done task (2) @done            # completed (green)
> in progress (3) @progress      # in progress (blue)
> cancelled (2) @cancelled       # cancelled (grey)
> custom color (3) @color:ff6b6b`;
	}
}
