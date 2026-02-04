import { Plugin, WorkspaceLeaf, addIcon } from 'obsidian';
import { TimelineView, VIEW_TYPE_TIMELINE } from './src/ui/TimelineView';
import {
	TimelineGanttSettings,
	TimelineGanttSettingsTab,
	DEFAULT_SETTINGS,
} from './src/settings/SettingsTab';

// Stylized octopus with two dot eyes (gray for ribbon, uses currentColor)
const RUNALONE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="currentColor" stroke="currentColor">
  <circle cx="50" cy="40" r="22"/>
  <circle cx="42" cy="38" r="3" fill="var(--background-primary, #fff)"/>
  <circle cx="58" cy="38" r="3" fill="var(--background-primary, #fff)"/>
  <path d="M35 58 C25 65, 25 80, 35 85" fill="none" stroke-width="6" stroke-linecap="round"/>
  <path d="M45 60 C40 70, 42 85, 45 90" fill="none" stroke-width="6" stroke-linecap="round"/>
  <path d="M50 60 C50 72, 50 85, 50 92" fill="none" stroke-width="6" stroke-linecap="round"/>
  <path d="M55 60 C58 70, 58 85, 55 90" fill="none" stroke-width="6" stroke-linecap="round"/>
  <path d="M65 58 C75 65, 75 80, 65 85" fill="none" stroke-width="6" stroke-linecap="round"/>
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

		this.addRibbonIcon('runalone', 'Open Runalone Project Manager', () => {
			this.activateView();
		});

		this.addCommand({
			id: 'open-runalone-project-manager',
			name: 'Open Runalone Project Manager',
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
