import { ItemView, WorkspaceLeaf, Notice } from 'obsidian';
import {
	TimelineState,
	ZoomLevel,
	ViewMode,
	TaskStatus,
	createEmptyState,
	Task,
	Project,
} from '../core/TaskModel';
import { Parser } from '../core/Parser';
import { TimelineCalculator } from '../core/TimelineCalculator';
import { FileSync } from '../core/FileSync';
import { GanttRenderer } from './GanttRenderer';
import { KanbanRenderer } from './KanbanRenderer';
import { DragHandler } from './DragHandler';
import { Toolbar } from './Toolbar';
import { TaskEditModal, TaskEditResult } from './TaskEditModal';
import { ProjectEditModal, ProjectEditResult } from './ProjectEditModal';
import { UndoManager, UndoableAction } from '../utils/UndoManager';
import { cloneDate, addDays } from '../utils/DateUtils';
import { TimelineGanttSettings } from '../settings/SettingsTab';

export const VIEW_TYPE_TIMELINE = 'timeline-gantt-view';

export class TimelineView extends ItemView {
	private state: TimelineState;
	private parser: Parser;
	private calculator: TimelineCalculator;
	private fileSync: FileSync;
	private renderer: GanttRenderer;
	private kanbanRenderer: KanbanRenderer;
	private dragHandler: DragHandler;
	private toolbar: Toolbar;
	private undoManager: UndoManager;

	private toolbarContainer: HTMLElement | null = null;
	private contentContainer: HTMLElement | null = null;
	private svgContainer: HTMLElement | null = null;
	private kanbanContainer: HTMLElement | null = null;

	private settings: TimelineGanttSettings;
	private currentViewMode: ViewMode = 'gantt';

	constructor(leaf: WorkspaceLeaf, settings: TimelineGanttSettings) {
		super(leaf);
		this.settings = settings;
		this.state = createEmptyState();

		this.parser = new Parser();
		this.calculator = new TimelineCalculator();
		this.fileSync = new FileSync(this.app);
		this.renderer = new GanttRenderer({
			taskBarHeight: settings.taskBarHeight,
			rowHeight: settings.rowHeight,
			labelWidth: settings.labelColumnWidth,
		});
		this.kanbanRenderer = new KanbanRenderer();
		this.dragHandler = new DragHandler();
		this.toolbar = new Toolbar();
		this.undoManager = new UndoManager();
	}

	getViewType(): string {
		return VIEW_TYPE_TIMELINE;
	}

	getDisplayText(): string {
		return 'Runalone Project Manager';
	}

	getIcon(): string {
		return 'runalone';
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass('timeline-gantt-container');

		this.toolbarContainer = container.createDiv({ cls: 'timeline-toolbar-container' });
		this.contentContainer = container.createDiv({ cls: 'timeline-content-container' });
		this.svgContainer = this.contentContainer.createDiv({ cls: 'timeline-svg-container' });
		this.kanbanContainer = this.contentContainer.createDiv({ cls: 'timeline-kanban-container' });
		this.kanbanContainer.style.display = 'none';

		this.setupToolbar();
		this.setupRenderer();
		this.setupKanbanRenderer();
		this.setupDragHandler();
		this.setupFileSync();
		this.setupUndoManager();
		this.setupKeyboardShortcuts();

		await this.loadAndRender();
	}

	private setupToolbar(): void {
		this.toolbar.setCallbacks({
			onZoomChange: (level) => this.handleZoomChange(level),
			onViewModeChange: (mode) => this.handleViewModeChange(mode),
			onCollapseAll: () => this.handleCollapseAll(),
			onExpandAll: () => this.handleExpandAll(),
			onToggleProjectsOnly: () => this.handleToggleProjectsOnly(),
			onUndo: () => this.handleUndo(),
			onRedo: () => this.handleRedo(),
			onRefresh: () => this.loadAndRender(),
			onAddTask: () => this.handleAddTask(),
			onAddProject: () => this.handleAddProject(),
		});

		if (this.toolbarContainer) {
			this.toolbar.render(this.toolbarContainer, this.settings.defaultZoomLevel, this.currentViewMode, this.state.projectsOnly);
		}
	}

	private setupKanbanRenderer(): void {
		this.kanbanRenderer.setCallbacks({
			onTaskStatusChange: (taskId, newStatus) => this.handleTaskStatusChange(taskId, newStatus),
			onTaskClick: (taskId) => this.handleTaskClick(taskId),
		});
	}

	private setupRenderer(): void {
		this.renderer.setShowDragHandles(this.settings.showDragHandles);
		this.renderer.setCallbacks({
			onTaskClick: (taskId) => this.handleTaskClick(taskId),
			onTaskDragStart: (taskId, e, type) => this.handleTaskDragStart(taskId, e, type),
			onTaskLabelClick: (taskId, currentTitle) => this.handleTaskLabelEdit(taskId, currentTitle),
			onTaskDelete: (taskId) => this.handleTaskDelete(taskId),
			onTaskIndent: (taskId) => this.handleTaskIndentById(taskId),
			onTaskOutdent: (taskId) => this.handleTaskOutdentById(taskId),
			onProjectClick: (projectId) => this.handleProjectClick(projectId),
			onProjectNameClick: (projectId) => this.handleProjectNameEdit(projectId),
			onTaskReorder: (taskId, targetProjectId, targetIndex) => this.handleTaskReorder(taskId, targetProjectId, targetIndex),
			onProjectReorder: (projectId, targetIndex) => this.handleProjectReorder(projectId, targetIndex),
			onOpenLinkedNote: (notePath) => this.handleOpenLinkedNote(notePath),
			onProjectToggle: (projectId) => this.handleProjectToggle(projectId),
		});
	}

	private setupDragHandler(): void {
		if (!this.svgContainer) return;

		this.dragHandler.initialize(this.svgContainer, this.renderer, this.state, {
			onDragUpdate: (taskId, newStartDate, newDuration) => {
				this.handleDragUpdate(taskId, newStartDate, newDuration);
			},
			onDragEnd: (taskId, newStartDate, newDuration) => {
				this.handleDragEnd(taskId, newStartDate, newDuration);
			},
		});
	}

	private setupFileSync(): void {
		this.fileSync.setCallbacks({
			onFileChanged: () => {
				if (this.settings.autoRefresh) {
					this.loadAndRender();
				}
			},
		});
	}

	private setupUndoManager(): void {
		this.undoManager.setOnStateChange(() => {
			this.toolbar.updateUndoRedoState(
				this.undoManager.canUndo(),
				this.undoManager.canRedo()
			);
		});
	}

	private setupKeyboardShortcuts(): void {
		this.containerEl.addEventListener('keydown', (e) => {
			if (e.ctrlKey || e.metaKey) {
				if (e.key === 'z' && !e.shiftKey) {
					e.preventDefault();
					this.handleUndo();
				} else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
					e.preventDefault();
					this.handleRedo();
				}
			}
		});
	}

	async loadAndRender(): Promise<void> {
		try {
			const content = await this.fileSync.readFile(this.settings.projectsFilePath);

			if (!content) {
				await this.fileSync.createProjectsFile(this.settings.projectsFilePath);
				const newContent = await this.fileSync.readFile(this.settings.projectsFilePath);
				if (!newContent) {
					new Notice('Could not read or create projects file');
					return;
				}
				await this.processContent(newContent);
			} else {
				await this.processContent(content);
			}

			this.fileSync.watchFile(this.settings.projectsFilePath);
		} catch (error) {
			console.error('Failed to load timeline:', error);
			new Notice('Failed to load timeline');
		}
	}

	private async processContent(content: string): Promise<void> {
		const parseResult = this.parser.parse(content);
		const { projects, conflicts, globalEndDate } = this.calculator.calculate(parseResult);

		this.state = {
			...this.state,
			projects,
			globalStartDate: parseResult.globalStartDate,
			globalEndDate,
			zoomLevel: this.settings.defaultZoomLevel,
		};

		if (conflicts.length > 0) {
			new Notice(`Found ${conflicts.length} scheduling conflict(s)`);
		}

		this.render();
	}

	private render(): void {
		if (this.currentViewMode === 'gantt') {
			this.renderGanttView();
		} else {
			this.renderKanbanView();
		}
	}

	private renderGanttView(): void {
		if (!this.svgContainer || !this.kanbanContainer) return;

		// Show Gantt, hide Kanban
		this.svgContainer.style.display = '';
		this.kanbanContainer.style.display = 'none';

		this.renderer.render(this.svgContainer, this.state);
		this.dragHandler.updateState(this.state);

		this.svgContainer.querySelectorAll('.collapse-icon').forEach((icon) => {
			icon.addEventListener('click', (e) => {
				const taskId = (e.target as Element).getAttribute('data-task-id');
				if (taskId) {
					this.handleToggleCollapse(taskId);
				}
			});
		});
	}

	private renderKanbanView(): void {
		if (!this.svgContainer || !this.kanbanContainer) return;

		// Show Kanban, hide Gantt
		this.svgContainer.style.display = 'none';
		this.kanbanContainer.style.display = '';

		this.kanbanRenderer.render(this.kanbanContainer, this.state);
	}

	private handleViewModeChange(mode: ViewMode): void {
		this.currentViewMode = mode;
		this.renderToolbar();
		this.render();
	}

	private async handleTaskStatusChange(taskId: string, newStatus: TaskStatus): Promise<void> {
		const task = this.findTask(taskId);
		if (!task) return;

		await this.fileSync.updateTaskStatus(
			this.settings.projectsFilePath,
			task.lineNumber,
			newStatus
		);

		await this.loadAndRender();
		new Notice(`Task moved to ${newStatus.replace('_', ' ')}`);
	}

	private handleZoomChange(level: ZoomLevel): void {
		this.state = { ...this.state, zoomLevel: level };
		this.render();
	}

	private handleCollapseAll(): void {
		const allTaskIds = new Set<string>();
		for (const project of this.state.projects) {
			for (const task of project.flatTasks) {
				if (task.children.length > 0) {
					allTaskIds.add(task.id);
				}
			}
		}
		this.state = { ...this.state, collapsedTasks: allTaskIds };
		this.render();
	}

	private handleExpandAll(): void {
		this.state = { ...this.state, collapsedTasks: new Set(), projectsOnly: false };
		this.renderToolbar();
		this.render();
	}

	private handleToggleProjectsOnly(): void {
		this.state = { ...this.state, projectsOnly: !this.state.projectsOnly };
		this.renderToolbar();
		this.render();
	}

	private renderToolbar(): void {
		if (this.toolbarContainer) {
			this.toolbar.render(this.toolbarContainer, this.state.zoomLevel, this.currentViewMode, this.state.projectsOnly);
			this.toolbar.updateUndoRedoState(this.undoManager.canUndo(), this.undoManager.canRedo());
		}
	}

	private handleToggleCollapse(taskId: string): void {
		const newCollapsed = new Set(this.state.collapsedTasks);
		if (newCollapsed.has(taskId)) {
			newCollapsed.delete(taskId);
		} else {
			newCollapsed.add(taskId);
		}
		this.state = { ...this.state, collapsedTasks: newCollapsed };
		this.render();
	}

	private handleTaskClick(taskId: string): void {
		// Also update selected project based on task
		const task = this.findTask(taskId);
		let selectedProjectId = this.state.selectedProjectId;
		if (task) {
			for (const project of this.state.projects) {
				if (project.flatTasks.some(t => t.id === taskId)) {
					selectedProjectId = project.id;
					break;
				}
			}
		}
		this.state = { ...this.state, selectedTaskId: taskId, selectedProjectId };
		this.render();
	}

	private handleProjectClick(projectId: string): void {
		this.state = { ...this.state, selectedProjectId: projectId, selectedTaskId: null };
		this.render();
	}

	private handleProjectToggle(projectId: string): void {
		const newCollapsedProjects = new Set(this.state.collapsedProjects);
		if (newCollapsedProjects.has(projectId)) {
			newCollapsedProjects.delete(projectId);
		} else {
			newCollapsedProjects.add(projectId);
		}
		this.state = { ...this.state, collapsedProjects: newCollapsedProjects };
		this.render();
	}

	private async handleTaskDelete(taskId: string): Promise<void> {
		const task = this.findTask(taskId);
		if (!task) return;

		// Confirm deletion
		if (!confirm(`Delete task "${task.title}"?`)) {
			return;
		}

		await this.fileSync.deleteTask(
			this.settings.projectsFilePath,
			task.lineNumber
		);

		// Clear selection if deleted task was selected
		if (this.state.selectedTaskId === taskId) {
			this.state = { ...this.state, selectedTaskId: null };
		}

		await this.loadAndRender();
		new Notice('Task deleted');
	}

	private handleProjectNameEdit(projectId: string): void {
		const project = this.state.projects.find(p => p.id === projectId);
		if (!project) return;

		const projectIndex = this.state.projects.findIndex(p => p.id === projectId);

		// Select the project
		this.state = { ...this.state, selectedProjectId: projectId, selectedTaskId: null };
		this.render();

		const modal = new ProjectEditModal(
			this.app,
			project,
			async (result: ProjectEditResult) => {
				await this.fileSync.updateProject(
					this.settings.projectsFilePath,
					project.lineNumber,
					{
						name: result.name,
						icon: result.icon,
						linkedNote: result.linkedNote
					}
				);
				await this.loadAndRender();
			},
			async () => {
				// Delete callback
				const nextProject = this.state.projects[projectIndex + 1];
				const nextProjectLineNumber = nextProject ? nextProject.lineNumber : null;

				await this.fileSync.deleteProject(
					this.settings.projectsFilePath,
					project.lineNumber,
					nextProjectLineNumber
				);

				// Clear selection
				this.state = { ...this.state, selectedProjectId: null, selectedTaskId: null };

				await this.loadAndRender();
				new Notice('Project deleted');
			}
		);

		modal.open();
	}

	private async handleProjectReorder(projectId: string, targetIndex: number): Promise<void> {
		const project = this.state.projects.find(p => p.id === projectId);
		if (!project) return;

		const projectIndex = this.state.projects.findIndex(p => p.id === projectId);
		if (projectIndex === -1) return;

		// Find the next project's line number (to know where current project ends)
		const nextProject = this.state.projects[projectIndex + 1];
		const nextProjectLineNumber = nextProject ? nextProject.lineNumber : null;

		// Calculate target line number
		let targetLineNumber: number;
		if (targetIndex === 0) {
			// Move to the beginning - find the first project's line number
			targetLineNumber = this.state.projects[0].lineNumber;
		} else if (targetIndex >= this.state.projects.length) {
			// Move to the end - after the last project's last task
			const lastProject = this.state.projects[this.state.projects.length - 1];
			if (lastProject.flatTasks.length > 0) {
				targetLineNumber = lastProject.flatTasks[lastProject.flatTasks.length - 1].lineNumber + 1;
			} else {
				targetLineNumber = lastProject.lineNumber + 1;
			}
		} else {
			// Move before the project at targetIndex
			targetLineNumber = this.state.projects[targetIndex].lineNumber;
		}

		await this.fileSync.moveProject(
			this.settings.projectsFilePath,
			project.lineNumber,
			nextProjectLineNumber,
			targetLineNumber
		);

		await this.loadAndRender();
	}

	private async handleTaskReorder(taskId: string, targetProjectId: string, targetIndex: number): Promise<void> {
		const task = this.findTask(taskId);
		if (!task) return;

		// Find the target project
		const targetProject = this.state.projects.find(p => p.id === targetProjectId);
		if (!targetProject) return;

		// Calculate target line number based on task index
		let targetLineNumber: number;

		if (targetIndex === 0) {
			// Insert right after the project header
			targetLineNumber = targetProject.lineNumber + 1;
		} else if (targetIndex >= targetProject.flatTasks.length) {
			// Insert after the last task
			const lastTask = targetProject.flatTasks[targetProject.flatTasks.length - 1];
			targetLineNumber = lastTask.lineNumber + 1;
		} else {
			// Insert at the position of the task at targetIndex
			// (the task currently at targetIndex will be pushed down)
			targetLineNumber = targetProject.flatTasks[targetIndex].lineNumber;
		}

		// Adjust target line number if we're moving down within the same content
		// The moveTask function already handles this adjustment
		await this.fileSync.moveTask(
			this.settings.projectsFilePath,
			task.lineNumber,
			targetProjectId,
			targetLineNumber
		);

		await this.loadAndRender();
	}

	private handleTaskDragStart(
		taskId: string,
		e: MouseEvent,
		type: 'move' | 'resize-start' | 'resize-end'
	): void {
		this.dragHandler.startDrag(taskId, e, type);
	}

	private handleDragUpdate(taskId: string, newStartDate: Date, newDuration: number): void {
		const { projects } = this.calculator.recalculateFromDrag(
			this.state.projects,
			taskId,
			newStartDate,
			newDuration
		);

		const tempState = { ...this.state, projects };
		this.renderer.render(this.svgContainer!, tempState);
	}

	private async handleDragEnd(
		taskId: string,
		newStartDate: Date,
		newDuration: number
	): Promise<void> {
		const task = this.findTask(taskId);
		if (!task) return;

		const action: UndoableAction = {
			type: 'task_resize',
			taskId,
			before: {
				startDate: cloneDate(task.startDate),
				duration: task.duration,
			},
			after: {
				startDate: cloneDate(newStartDate),
				duration: newDuration,
			},
		};

		this.undoManager.pushAction(action);

		await this.fileSync.updateTask(
			this.settings.projectsFilePath,
			task,
			{ duration: newDuration, startDate: newStartDate },
			this.state.globalStartDate
		);

		// Update parent durations based on children
		await this.updateParentDurations(task);

		await this.loadAndRender();
	}

	private async updateParentDurations(task: Task): Promise<void> {
		// Get all parent tasks that need updating
		const parentsToUpdate = this.calculator.getParentTasksToUpdate(
			this.findProjectForTask(task)?.flatTasks || [],
			task
		);

		if (parentsToUpdate.length === 0) return;

		// Calculate new durations for each parent based on their children
		const parentUpdates = parentsToUpdate.map(parent => {
			// Recalculate duration based on children
			const childStartDates = parent.children.map(c => c.startDate);
			const childEndDates = parent.children.map(c => c.endDate);

			const earliestStart = new Date(Math.min(...childStartDates.map(d => d.getTime())));
			const latestEnd = new Date(Math.max(...childEndDates.map(d => d.getTime())));

			const durationMs = latestEnd.getTime() - earliestStart.getTime();
			const durationDays = Math.max(1, Math.ceil(durationMs / (1000 * 60 * 60 * 24)));

			return {
				lineNumber: parent.lineNumber,
				duration: durationDays
			};
		});

		await this.fileSync.updateParentDurations(
			this.settings.projectsFilePath,
			parentUpdates
		);
	}

	private findProjectForTask(task: Task): Project | null {
		for (const project of this.state.projects) {
			if (project.flatTasks.some(t => t.id === task.id)) {
				return project;
			}
		}
		return null;
	}

	private async handleUndo(): Promise<void> {
		const action = this.undoManager.undo();
		if (!action) return;

		const task = this.findTask(action.taskId);
		if (!task) return;

		await this.fileSync.updateTask(
			this.settings.projectsFilePath,
			task,
			{ duration: action.before.duration },
			this.state.globalStartDate
		);

		await this.loadAndRender();
	}

	private async handleRedo(): Promise<void> {
		const action = this.undoManager.redo();
		if (!action) return;

		const task = this.findTask(action.taskId);
		if (!task) return;

		await this.fileSync.updateTask(
			this.settings.projectsFilePath,
			task,
			{ duration: action.after.duration },
			this.state.globalStartDate
		);

		await this.loadAndRender();
	}

	private async handleAddProject(): Promise<void> {
		// Find the last line number in the file
		let insertAfterLineNumber = 0;

		if (this.state.projects.length > 0) {
			const lastProject = this.state.projects[this.state.projects.length - 1];
			if (lastProject.flatTasks.length > 0) {
				const lastTask = lastProject.flatTasks[lastProject.flatTasks.length - 1];
				insertAfterLineNumber = lastTask.lineNumber;
			} else {
				insertAfterLineNumber = lastProject.lineNumber;
			}
		}

		await this.fileSync.insertLine(
			this.settings.projectsFilePath,
			insertAfterLineNumber,
			'\n## New Project'
		);

		await this.loadAndRender();
		new Notice('New project created');
	}

	private async handleAddTask(): Promise<void> {
		if (this.state.projects.length === 0) {
			new Notice('No project found. Please create a project first.');
			return;
		}

		// Use selected project, or find project from selected task, or use first project
		let targetProject = this.state.projects[0];
		let insertAfterLineNumber = targetProject.lineNumber;

		// First priority: use the selected project
		if (this.state.selectedProjectId) {
			const selectedProject = this.state.projects.find(p => p.id === this.state.selectedProjectId);
			if (selectedProject) {
				targetProject = selectedProject;
				// Insert after the last task in the selected project
				if (targetProject.flatTasks.length > 0) {
					const lastTask = targetProject.flatTasks[targetProject.flatTasks.length - 1];
					insertAfterLineNumber = lastTask.lineNumber;
				} else {
					insertAfterLineNumber = targetProject.lineNumber;
				}
			}
		}

		// If a task is selected, insert after that task
		if (this.state.selectedTaskId) {
			const selectedTask = this.findTask(this.state.selectedTaskId);
			if (selectedTask) {
				insertAfterLineNumber = selectedTask.lineNumber;
			}
		} else if (targetProject.flatTasks.length > 0 && !this.state.selectedProjectId) {
			// Insert after the last task in the project
			const lastTask = targetProject.flatTasks[targetProject.flatTasks.length - 1];
			insertAfterLineNumber = lastTask.lineNumber;
		}

		const today = new Date();
		const dateStr = today.toISOString().split('T')[0];
		const newTaskLine = `> task (1) @start:${dateStr}`;

		await this.fileSync.insertLine(
			this.settings.projectsFilePath,
			insertAfterLineNumber,
			newTaskLine
		);

		await this.loadAndRender();
	}

	private async handleIndentTask(): Promise<void> {
		if (!this.state.selectedTaskId) {
			new Notice('Select a task first (click on the task bar)');
			return;
		}

		await this.handleTaskIndentById(this.state.selectedTaskId);
	}

	private async handleTaskIndentById(taskId: string): Promise<void> {
		const task = this.findTask(taskId);
		if (!task) {
			new Notice('Task not found');
			return;
		}

		// Check if this is the first task in the project (level 1)
		// First task cannot be made a child because there's no parent
		if (task.indexInProject === 0 && task.level === 1) {
			new Notice('First task cannot be made a child');
			return;
		}

		// Maximum 3 levels of nesting
		if (task.level >= 3) {
			new Notice('Maximum nesting level reached (3 levels)');
			return;
		}

		await this.fileSync.indentTask(
			this.settings.projectsFilePath,
			task.lineNumber
		);

		await this.loadAndRender();
	}

	private async handleOutdentTask(): Promise<void> {
		if (!this.state.selectedTaskId) {
			new Notice('Select a task first (click on the task bar)');
			return;
		}

		await this.handleTaskOutdentById(this.state.selectedTaskId);
	}

	private async handleTaskOutdentById(taskId: string): Promise<void> {
		const task = this.findTask(taskId);
		if (!task) {
			new Notice('Task not found');
			return;
		}

		// Cannot outdent if already at level 1
		if (task.level <= 1) {
			new Notice('Task is already at top level');
			return;
		}

		await this.fileSync.outdentTask(
			this.settings.projectsFilePath,
			task.lineNumber
		);

		await this.loadAndRender();
	}

	private handleTaskLabelEdit(taskId: string, _currentTitle: string): void {
		const task = this.findTask(taskId);
		if (!task) return;

		// Select the task
		this.state = { ...this.state, selectedTaskId: taskId };
		this.render();

		const modal = new TaskEditModal(this.app, task, async (result: TaskEditResult) => {
			await this.fileSync.updateTaskFull(
				this.settings.projectsFilePath,
				task.lineNumber,
				{
					title: result.title,
					duration: result.duration,
					startDate: result.startDate,
					isMilestone: result.isMilestone,
					status: result.status,
				}
			);

			// Update parent durations if this task has a parent
			if (task.parent) {
				// We need to recalculate with the new duration
				const updatedTask = { ...task, duration: result.duration };
				if (result.startDate) {
					updatedTask.startDate = result.startDate;
					updatedTask.endDate = new Date(result.startDate.getTime() + result.duration * 24 * 60 * 60 * 1000);
				} else {
					updatedTask.endDate = new Date(task.startDate.getTime() + result.duration * 24 * 60 * 60 * 1000);
				}
				await this.updateParentDurations(updatedTask as Task);
			}

			await this.loadAndRender();
		});

		modal.open();
	}

	private findTask(taskId: string): Task | null {
		for (const project of this.state.projects) {
			const task = project.flatTasks.find(t => t.id === taskId);
			if (task) return task;
		}
		return null;
	}

	private async handleOpenLinkedNote(noteName: string): Promise<void> {
		// Find the file by basename (since linkedNote stores only the basename)
		const file = this.app.vault.getMarkdownFiles().find(
			f => f.basename === noteName
		);

		if (file) {
			await this.app.workspace.openLinkText(file.path, '', false);
		} else {
			new Notice(`Note not found: ${noteName}`);
		}
	}

	updateSettings(settings: TimelineGanttSettings): void {
		this.settings = settings;
		this.renderer = new GanttRenderer({
			taskBarHeight: settings.taskBarHeight,
			rowHeight: settings.rowHeight,
			labelWidth: settings.labelColumnWidth,
		});
		this.renderer.setShowDragHandles(settings.showDragHandles);
		this.setupRenderer();
		this.loadAndRender();
	}

	async onClose(): Promise<void> {
		this.fileSync.destroy();
		this.dragHandler.destroy();
		this.toolbar.destroy();
		this.undoManager.destroy();
		this.kanbanRenderer.destroy();
	}
}
