import { ZoomLevel, ViewMode } from '../core/TaskModel';
import { ZoomController } from './ZoomController';
import {
	createRunaloneLogo,
	createTimelineIcon,
	createKanbanIcon,
	createFolderPlusIcon,
	createPlusIcon,
	createProjectsOnlyIcon,
	createCollapseIcon,
	createExpandIcon,
	createUndoIcon,
	createRedoIcon,
	createRefreshIcon,
} from '../utils/Icons';

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
		logo.appendChild(createRunaloneLogo());
		const textSpan = document.createElement('span');
		textSpan.className = 'toolbar-logo-text';
		const strong = document.createElement('strong');
		strong.textContent = 'Runalone';
		textSpan.appendChild(strong);
		textSpan.appendChild(document.createTextNode(' Project Manager'));
		logo.appendChild(textSpan);
	}

	private renderViewToggle(container: HTMLElement, currentMode: ViewMode): void {
		const toggle = container.createDiv({ cls: 'view-toggle' });

		const timelineBtn = toggle.createEl('button', {
			cls: 'view-tab' + (currentMode === 'gantt' ? ' active' : ''),
			attr: { title: 'Timeline' },
		});
		timelineBtn.appendChild(createTimelineIcon());
		timelineBtn.onclick = () => this.callbacks?.onViewModeChange('gantt');

		const kanbanBtn = toggle.createEl('button', {
			cls: 'view-tab' + (currentMode === 'kanban' ? ' active' : ''),
			attr: { title: 'Kanban' },
		});
		kanbanBtn.appendChild(createKanbanIcon());
		kanbanBtn.onclick = () => this.callbacks?.onViewModeChange('kanban');
	}

	private renderAddButtons(container: HTMLElement): void {
		// Add project
		const projectBtn = container.createEl('button', {
			cls: 'toolbar-button',
			attr: { title: 'New project' },
		});
		projectBtn.appendChild(createFolderPlusIcon());
		projectBtn.onclick = () => this.callbacks?.onAddProject();

		// Add task
		const taskBtn = container.createEl('button', {
			cls: 'toolbar-button',
			attr: { title: 'Add task' },
		});
		taskBtn.appendChild(createPlusIcon());
		taskBtn.onclick = () => this.callbacks?.onAddTask();
	}

	private renderCollapseExpand(container: HTMLElement, projectsOnly: boolean): void {
		// Projects only toggle
		const projectsBtn = container.createEl('button', {
			cls: 'toolbar-button' + (projectsOnly ? ' is-active' : ''),
			attr: { title: 'Projects only' },
		});
		projectsBtn.appendChild(createProjectsOnlyIcon());
		projectsBtn.onclick = () => this.callbacks?.onToggleProjectsOnly();

		const collapseBtn = container.createEl('button', {
			cls: 'toolbar-button',
			attr: { title: 'Collapse all' },
		});
		collapseBtn.appendChild(createCollapseIcon());
		collapseBtn.onclick = () => this.callbacks?.onCollapseAll();

		const expandBtn = container.createEl('button', {
			cls: 'toolbar-button',
			attr: { title: 'Expand all' },
		});
		expandBtn.appendChild(createExpandIcon());
		expandBtn.onclick = () => this.callbacks?.onExpandAll();
	}

	private renderUndoRedo(container: HTMLElement): void {
		const undoBtn = container.createEl('button', {
			cls: `toolbar-button${this.canUndo ? '' : ' is-disabled'}`,
			attr: { title: 'Undo' },
		});
		undoBtn.appendChild(createUndoIcon());
		undoBtn.onclick = () => this.canUndo && this.callbacks?.onUndo();

		const redoBtn = container.createEl('button', {
			cls: `toolbar-button${this.canRedo ? '' : ' is-disabled'}`,
			attr: { title: 'Redo' },
		});
		redoBtn.appendChild(createRedoIcon());
		redoBtn.onclick = () => this.canRedo && this.callbacks?.onRedo();
	}

	private renderRefresh(container: HTMLElement): void {
		const btn = container.createEl('button', {
			cls: 'toolbar-button',
			attr: { title: 'Refresh' },
		});
		btn.appendChild(createRefreshIcon());
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
