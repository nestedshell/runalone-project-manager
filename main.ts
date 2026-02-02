import { Plugin, WorkspaceLeaf, addIcon } from 'obsidian';
import { TimelineView, VIEW_TYPE_TIMELINE } from './src/ui/TimelineView';
import {
	TimelineGanttSettings,
	TimelineGanttSettingsTab,
	DEFAULT_SETTINGS,
} from './src/settings/SettingsTab';

// Simple stick figure: circle head + triangle body
const RUNALONE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <circle cx="12" cy="5" r="4"/>
  <polygon points="12,10 4,22 20,22"/>
</svg>`;

export default class TimelineGanttPlugin extends Plugin {
	settings: TimelineGanttSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();

		addIcon('runalone', RUNALONE_ICON);

		this.registerView(
			VIEW_TYPE_TIMELINE,
			(leaf) => new TimelineView(leaf, this.settings)
		);

		this.addRibbonIcon('runalone', 'Open Runalone Projects', () => {
			this.activateView();
		});

		this.addCommand({
			id: 'open-runalone-projects',
			name: 'Open Runalone Projects',
			callback: () => {
				this.activateView();
			},
		});

		this.addCommand({
			id: 'create-projects-file',
			name: 'Create Projects File',
			callback: async () => {
				const filePath = this.settings.projectsFilePath;
				const existingFile = this.app.vault.getAbstractFileByPath(filePath);

				if (existingFile) {
					this.app.workspace.openLinkText(filePath, '', false);
					return;
				}

				const today = new Date().toISOString().split('T')[0];
				const content = `# My Projects
@start: ${today}

## Sample Project
> Planning phase (5)
> Development (10) @after:1
>> Backend setup (4)
>> Frontend setup (4)
>> Integration (2) @after:1 @after:2
> Testing (5) @after:2
> Deployment (2) @after:3 @milestone
`;

				await this.app.vault.create(filePath, content);
				this.app.workspace.openLinkText(filePath, '', false);
			},
		});

		this.addSettingTab(new TimelineGanttSettingsTab(this.app, this));
	}

	async onunload(): Promise<void> {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_TIMELINE);
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_TIMELINE);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({
					type: VIEW_TYPE_TIMELINE,
					active: true,
				});
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);

		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TIMELINE);
		for (const leaf of leaves) {
			const view = leaf.view as TimelineView;
			if (view && view.updateSettings) {
				view.updateSettings(this.settings);
			}
		}
	}
}
