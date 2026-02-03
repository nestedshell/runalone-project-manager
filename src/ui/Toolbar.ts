import { ZoomLevel, ViewMode } from '../core/TaskModel';
import { ZoomController } from './ZoomController';

export interface ToolbarCallbacks {
	onZoomChange: (level: ZoomLevel) => void;
	onViewModeChange: (mode: ViewMode) => void;
	onCollapseAll: () => void;
	onExpandAll: () => void;
	onToggleProjectsOnly: () => void;
	onUndo: () => void;
	onRedo: () => void;
	onRefresh: () => void;
	onAddTask: () => void;
	onAddProject: () => void;
}

export class Toolbar {
	private container: HTMLElement | null = null;
	private callbacks: ToolbarCallbacks | null = null;
	private zoomController: ZoomController;
	private canUndo = false;
	private canRedo = false;

	constructor() {
		this.zoomController = new ZoomController();
	}

	setCallbacks(callbacks: ToolbarCallbacks): void {
		this.callbacks = callbacks;
		this.zoomController.setCallbacks({
			onZoomChange: callbacks.onZoomChange,
		});
	}

	render(container: HTMLElement, zoomLevel: ZoomLevel, viewMode: ViewMode = 'gantt', projectsOnly: boolean = false): void {
		this.container = container;
		container.empty();
		container.addClass('gantt-toolbar');

		const left = container.createDiv({ cls: 'toolbar-section toolbar-left' });
		const center = container.createDiv({ cls: 'toolbar-section toolbar-center' });
		const right = container.createDiv({ cls: 'toolbar-section toolbar-right' });

		// LEFT: Logo + Nome
		this.renderLogo(left);

		left.createDiv({ cls: 'toolbar-separator' });

		// LEFT: Toggle Vista
		this.renderViewToggle(left, viewMode);

		left.createDiv({ cls: 'toolbar-separator' });

		// LEFT: Add Project + Add Task
		this.renderAddButtons(left);

		// CENTER: Zoom + Collapse/Expand (solo in Gantt)
		if (viewMode === 'gantt') {
			this.zoomController.render(center, zoomLevel);
			center.createDiv({ cls: 'toolbar-separator' });
			this.renderCollapseExpand(center, projectsOnly);
		}

		// RIGHT: Undo/Redo + Refresh
		this.renderUndoRedo(right);
		right.createDiv({ cls: 'toolbar-separator' });
		this.renderRefresh(right);
	}

	private renderLogo(container: HTMLElement): void {
		const logo = container.createDiv({ cls: 'toolbar-logo' });
		logo.innerHTML = `
			<svg width="20" height="20" viewBox="0 0 100 100" fill="#8b5cf6" stroke="#8b5cf6">
				<circle cx="50" cy="40" r="22"/>
				<circle cx="42" cy="38" r="3" fill="#ffffff"/>
				<circle cx="58" cy="38" r="3" fill="#ffffff"/>
				<path d="M35 58 C25 65, 25 80, 35 85" fill="none" stroke-width="6" stroke-linecap="round"/>
				<path d="M45 60 C40 70, 42 85, 45 90" fill="none" stroke-width="6" stroke-linecap="round"/>
				<path d="M50 60 C50 72, 50 85, 50 92" fill="none" stroke-width="6" stroke-linecap="round"/>
				<path d="M55 60 C58 70, 58 85, 55 90" fill="none" stroke-width="6" stroke-linecap="round"/>
				<path d="M65 58 C75 65, 75 80, 65 85" fill="none" stroke-width="6" stroke-linecap="round"/>
			</svg>
			<span><strong>Runalone</strong> Project Manager</span>
		`;
	}

	private renderViewToggle(container: HTMLElement, currentMode: ViewMode): void {
		const toggle = container.createDiv({ cls: 'view-toggle' });

		const timelineBtn = toggle.createEl('button', {
			cls: 'view-tab' + (currentMode === 'gantt' ? ' active' : ''),
			attr: { title: 'Timeline' },
		});
		timelineBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="16" height="4" rx="1"/><rect x="5" y="10" width="10" height="4" rx="1"/><rect x="3" y="16" width="13" height="4" rx="1"/></svg>`;
		timelineBtn.onclick = () => this.callbacks?.onViewModeChange('gantt');

		const kanbanBtn = toggle.createEl('button', {
			cls: 'view-tab' + (currentMode === 'kanban' ? ' active' : ''),
			attr: { title: 'Kanban' },
		});
		kanbanBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="5" height="16" rx="1"/><rect x="10" y="3" width="5" height="10" rx="1"/><rect x="17" y="3" width="5" height="6" rx="1"/></svg>`;
		kanbanBtn.onclick = () => this.callbacks?.onViewModeChange('kanban');
	}

	private renderAddButtons(container: HTMLElement): void {
		// Add Project
		const projectBtn = container.createEl('button', {
			cls: 'toolbar-button',
			attr: { title: 'New Project' },
		});
		projectBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><line x1="12" y1="10" x2="12" y2="16"/><line x1="9" y1="13" x2="15" y2="13"/></svg>`;
		projectBtn.onclick = () => this.callbacks?.onAddProject();

		// Add Task
		const taskBtn = container.createEl('button', {
			cls: 'toolbar-button',
			attr: { title: 'Add Task' },
		});
		taskBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
		taskBtn.onclick = () => this.callbacks?.onAddTask();
	}

	private renderCollapseExpand(container: HTMLElement, projectsOnly: boolean): void {
		// Projects Only toggle
		const projectsBtn = container.createEl('button', {
			cls: 'toolbar-button' + (projectsOnly ? ' is-active' : ''),
			attr: { title: 'Projects Only' },
		});
		projectsBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="6" rx="1"/><rect x="3" y="12" width="18" height="6" rx="1" opacity="0.4"/></svg>`;
		projectsBtn.onclick = () => this.callbacks?.onToggleProjectsOnly();

		const collapseBtn = container.createEl('button', {
			cls: 'toolbar-button',
			attr: { title: 'Collapse All' },
		});
		collapseBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/></svg>`;
		collapseBtn.onclick = () => this.callbacks?.onCollapseAll();

		const expandBtn = container.createEl('button', {
			cls: 'toolbar-button',
			attr: { title: 'Expand All' },
		});
		expandBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>`;
		expandBtn.onclick = () => this.callbacks?.onExpandAll();
	}

	private renderUndoRedo(container: HTMLElement): void {
		const undoBtn = container.createEl('button', {
			cls: `toolbar-button${this.canUndo ? '' : ' is-disabled'}`,
			attr: { title: 'Undo' },
		});
		undoBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>`;
		undoBtn.onclick = () => this.canUndo && this.callbacks?.onUndo();

		const redoBtn = container.createEl('button', {
			cls: `toolbar-button${this.canRedo ? '' : ' is-disabled'}`,
			attr: { title: 'Redo' },
		});
		redoBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>`;
		redoBtn.onclick = () => this.canRedo && this.callbacks?.onRedo();
	}

	private renderRefresh(container: HTMLElement): void {
		const btn = container.createEl('button', {
			cls: 'toolbar-button',
			attr: { title: 'Refresh' },
		});
		btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>`;
		btn.onclick = () => this.callbacks?.onRefresh();
	}

	updateUndoRedoState(canUndo: boolean, canRedo: boolean): void {
		this.canUndo = canUndo;
		this.canRedo = canRedo;
	}

	destroy(): void {
		this.zoomController.destroy();
		this.container = null;
		this.callbacks = null;
	}
}
