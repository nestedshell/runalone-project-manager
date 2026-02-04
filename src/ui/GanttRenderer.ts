import {
	Task,
	Project,
	TimelineState,
	RenderConfig,
	DEFAULT_RENDER_CONFIG,
	ZoomLevel,
} from '../core/TaskModel';
import {
	daysBetween,
	formatDate,
	isWeekend,
	generateDateRange,
	generateWeekRange,
	generateMonthRange,
	getWeekNumber,
	getMonthName,
	addDays,
	isSameDay,
} from '../utils/DateUtils';

export class GanttRenderer {
	private svg: SVGSVGElement | null = null;
	private container: HTMLElement | null = null;
	private config: RenderConfig;
	private state: TimelineState | null = null;
	private showDragHandles: boolean = true;
	private onTaskClick: ((taskId: string) => void) | null = null;
	private onTaskDragStart: ((taskId: string, e: MouseEvent, type: 'move' | 'resize-start' | 'resize-end') => void) | null = null;
	private onTaskLabelClick: ((taskId: string, currentTitle: string) => void) | null = null;
	private onTaskDelete: ((taskId: string) => void) | null = null;
	private onTaskIndent: ((taskId: string) => void) | null = null;
	private onTaskOutdent: ((taskId: string) => void) | null = null;
	private onProjectClick: ((projectId: string) => void) | null = null;
	private onProjectNameClick: ((projectId: string) => void) | null = null;
	private onTaskReorder: ((taskId: string, targetProjectId: string, targetIndex: number) => void) | null = null;
	private onProjectReorder: ((projectId: string, targetIndex: number) => void) | null = null;
	private onOpenLinkedNote: ((notePath: string) => void) | null = null;
	private onProjectToggle: ((projectId: string) => void) | null = null;

	// Drag reorder state for tasks
	private dragReorderTaskId: string | null = null;
	private dragReorderGhost: SVGGElement | null = null;
	private dragReorderIndicator: SVGLineElement | null = null;
	private dragReorderStartY: number = 0;
	private taskRowPositions: Map<string, { y: number; projectId: string; index: number }> = new Map();

	// Drag reorder state for projects
	private dragReorderProjectId: string | null = null;
	private projectRowPositions: Map<string, { y: number; index: number }> = new Map();

	constructor(config: Partial<RenderConfig> = {}) {
		this.config = { ...DEFAULT_RENDER_CONFIG, ...config };
	}

	setShowDragHandles(show: boolean): void {
		this.showDragHandles = show;
	}

	setCallbacks(callbacks: {
		onTaskClick?: (taskId: string) => void;
		onTaskDragStart?: (taskId: string, e: MouseEvent, type: 'move' | 'resize-start' | 'resize-end') => void;
		onTaskLabelClick?: (taskId: string, currentTitle: string) => void;
		onTaskDelete?: (taskId: string) => void;
		onTaskIndent?: (taskId: string) => void;
		onTaskOutdent?: (taskId: string) => void;
		onProjectClick?: (projectId: string) => void;
		onProjectNameClick?: (projectId: string) => void;
		onTaskReorder?: (taskId: string, targetProjectId: string, targetIndex: number) => void;
		onProjectReorder?: (projectId: string, targetIndex: number) => void;
		onOpenLinkedNote?: (notePath: string) => void;
		onProjectToggle?: (projectId: string) => void;
	}): void {
		this.onTaskClick = callbacks.onTaskClick || null;
		this.onTaskDragStart = callbacks.onTaskDragStart || null;
		this.onTaskLabelClick = callbacks.onTaskLabelClick || null;
		this.onTaskDelete = callbacks.onTaskDelete || null;
		this.onTaskIndent = callbacks.onTaskIndent || null;
		this.onTaskOutdent = callbacks.onTaskOutdent || null;
		this.onProjectClick = callbacks.onProjectClick || null;
		this.onProjectNameClick = callbacks.onProjectNameClick || null;
		this.onTaskReorder = callbacks.onTaskReorder || null;
		this.onProjectReorder = callbacks.onProjectReorder || null;
		this.onOpenLinkedNote = callbacks.onOpenLinkedNote || null;
		this.onProjectToggle = callbacks.onProjectToggle || null;
	}

	render(container: HTMLElement, state: TimelineState): void {
		this.container = container;
		this.state = state;

		// Clear row positions for fresh mapping
		this.taskRowPositions.clear();
		this.projectRowPositions.clear();

		container.empty();

		const totalRows = this.countVisibleRows(state);
		const width = this.calculateWidth(state);
		const height = this.config.headerHeight + totalRows * this.config.rowHeight;

		this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		this.svg.setAttribute('width', String(width));
		this.svg.setAttribute('height', String(height));
		this.svg.setAttribute('class', 'gantt-svg');

		this.renderBackground(width, height);
		this.renderGrid(state, width, height);
		this.renderHeader(state, width);
		this.renderTodayLine(state, height);
		this.renderTasks(state);
		this.renderDependencies(state);

		container.appendChild(this.svg);
	}

	private getUnitWidth(): number {
		if (!this.state) return this.config.dayWidth;
		switch (this.state.zoomLevel) {
			case 'day': return this.config.dayWidth;
			case 'week': return this.config.weekWidth;
			case 'month': return this.config.monthWidth;
		}
	}

	private calculateWidth(state: TimelineState): number {
		const days = daysBetween(state.globalStartDate, state.globalEndDate) + 14;
		const unitWidth = this.getUnitWidth();
		let units: number;

		switch (state.zoomLevel) {
			case 'day':
				units = days;
				break;
			case 'week':
				units = Math.ceil(days / 7);
				break;
			case 'month':
				units = Math.ceil(days / 30);
				break;
		}

		return this.config.labelWidth + units * unitWidth;
	}

	private countVisibleRows(state: TimelineState): number {
		let count = 0;
		for (const project of state.projects) {
			count++;
			// Only count task rows if not in projectsOnly mode and project is not collapsed
			if (!state.projectsOnly && !state.collapsedProjects.has(project.id)) {
				count += this.countVisibleTaskRows(project.tasks, state.collapsedTasks);
			}
		}
		return count;
	}

	private countVisibleTaskRows(tasks: Task[], collapsed: Set<string>): number {
		let count = 0;
		for (const task of tasks) {
			count++;
			if (!collapsed.has(task.id) && task.children.length > 0) {
				count += this.countVisibleTaskRows(task.children, collapsed);
			}
		}
		return count;
	}

	private renderBackground(width: number, height: number): void {
		const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		bg.setAttribute('x', '0');
		bg.setAttribute('y', '0');
		bg.setAttribute('width', String(width));
		bg.setAttribute('height', String(height));
		bg.setAttribute('fill', 'var(--background-primary)');
		this.svg!.appendChild(bg);
	}

	private renderGrid(state: TimelineState, width: number, height: number): void {
		const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		gridGroup.setAttribute('class', 'gantt-grid');

		const unitWidth = this.getUnitWidth();
		let dates: Date[];

		switch (state.zoomLevel) {
			case 'day':
				dates = generateDateRange(state.globalStartDate, addDays(state.globalEndDate, 14));
				break;
			case 'week':
				dates = generateWeekRange(state.globalStartDate, addDays(state.globalEndDate, 14));
				break;
			case 'month':
				dates = generateMonthRange(state.globalStartDate, addDays(state.globalEndDate, 14));
				break;
		}

		dates.forEach((date, index) => {
			const x = this.config.labelWidth + index * unitWidth;

			if (state.zoomLevel === 'day' && isWeekend(date)) {
				const weekendBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
				weekendBg.setAttribute('x', String(x));
				weekendBg.setAttribute('y', String(this.config.headerHeight));
				weekendBg.setAttribute('width', String(unitWidth));
				weekendBg.setAttribute('height', String(height - this.config.headerHeight));
				weekendBg.setAttribute('fill', this.config.colors.weekend);
				gridGroup.appendChild(weekendBg);
			}

			const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
			line.setAttribute('x1', String(x));
			line.setAttribute('y1', String(this.config.headerHeight));
			line.setAttribute('x2', String(x));
			line.setAttribute('y2', String(height));
			line.setAttribute('stroke', this.config.colors.gridLine);
			line.setAttribute('stroke-width', '1');
			gridGroup.appendChild(line);
		});

		const totalRows = this.countVisibleRows(state);
		for (let i = 0; i <= totalRows; i++) {
			const y = this.config.headerHeight + i * this.config.rowHeight;
			const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
			line.setAttribute('x1', '0');
			line.setAttribute('y1', String(y));
			line.setAttribute('x2', String(width));
			line.setAttribute('y2', String(y));
			line.setAttribute('stroke', this.config.colors.gridLine);
			line.setAttribute('stroke-width', '1');
			gridGroup.appendChild(line);
		}

		this.svg!.appendChild(gridGroup);
	}

	private renderHeader(state: TimelineState, width: number): void {
		const headerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		headerGroup.setAttribute('class', 'gantt-header');

		const headerBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		headerBg.setAttribute('x', '0');
		headerBg.setAttribute('y', '0');
		headerBg.setAttribute('width', String(width));
		headerBg.setAttribute('height', String(this.config.headerHeight));
		headerBg.setAttribute('fill', 'var(--background-secondary)');
		headerGroup.appendChild(headerBg);

		const unitWidth = this.getUnitWidth();
		let dates: Date[];

		switch (state.zoomLevel) {
			case 'day':
				dates = generateDateRange(state.globalStartDate, addDays(state.globalEndDate, 14));
				break;
			case 'week':
				dates = generateWeekRange(state.globalStartDate, addDays(state.globalEndDate, 14));
				break;
			case 'month':
				dates = generateMonthRange(state.globalStartDate, addDays(state.globalEndDate, 14));
				break;
		}

		dates.forEach((date, index) => {
			const x = this.config.labelWidth + index * unitWidth + unitWidth / 2;

			let label: string;
			switch (state.zoomLevel) {
				case 'day':
					label = formatDate(date, 'short');
					break;
				case 'week':
					label = `W${getWeekNumber(date)}`;
					break;
				case 'month':
					label = getMonthName(date);
					break;
			}

			const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			text.setAttribute('x', String(x));
			text.setAttribute('y', String(this.config.headerHeight - 15));
			text.setAttribute('text-anchor', 'middle');
			text.setAttribute('fill', 'var(--text-normal)');
			text.setAttribute('font-size', '11');
			text.textContent = label;
			headerGroup.appendChild(text);

			if (state.zoomLevel === 'day' && date.getDate() === 1) {
				const monthText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
				monthText.setAttribute('x', String(x));
				monthText.setAttribute('y', '18');
				monthText.setAttribute('text-anchor', 'middle');
				monthText.setAttribute('fill', 'var(--text-muted)');
				monthText.setAttribute('font-size', '12');
				monthText.setAttribute('font-weight', 'bold');
				monthText.textContent = getMonthName(date, 'long') + ' ' + date.getFullYear();
				headerGroup.appendChild(monthText);
			}
		});

		this.svg!.appendChild(headerGroup);
	}

	private renderTodayLine(state: TimelineState, height: number): void {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		if (today < state.globalStartDate || today > addDays(state.globalEndDate, 14)) {
			return;
		}

		const x = this.dateToX(today, state);
		const columnWidth = this.getColumnWidth(state.zoomLevel);

		// Background highlight for today's column - more visible
		const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		rect.setAttribute('x', String(x));
		rect.setAttribute('y', String(0));
		rect.setAttribute('width', String(columnWidth));
		rect.setAttribute('height', String(height));
		rect.setAttribute('fill', 'var(--interactive-accent)');
		rect.setAttribute('fill-opacity', '0.15');
		rect.setAttribute('class', 'today-highlight');
		this.svg!.appendChild(rect);

		// Header highlight for today - even more visible
		const headerRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		headerRect.setAttribute('x', String(x));
		headerRect.setAttribute('y', String(0));
		headerRect.setAttribute('width', String(columnWidth));
		headerRect.setAttribute('height', String(this.config.headerHeight));
		headerRect.setAttribute('fill', 'var(--interactive-accent)');
		headerRect.setAttribute('fill-opacity', '0.25');
		headerRect.setAttribute('class', 'today-header-highlight');
		this.svg!.appendChild(headerRect);

		// Today line on left edge
		const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
		line.setAttribute('x1', String(x));
		line.setAttribute('y1', String(0));
		line.setAttribute('x2', String(x));
		line.setAttribute('y2', String(height));
		line.setAttribute('stroke', 'var(--interactive-accent)');
		line.setAttribute('stroke-width', '2');
		this.svg!.appendChild(line);
	}

	private getColumnWidth(zoomLevel: ZoomLevel): number {
		switch (zoomLevel) {
			case 'day': return this.config.dayWidth;
			case 'week': return this.config.weekWidth;
			case 'month': return this.config.monthWidth;
		}
	}

	private renderTasks(state: TimelineState): void {
		const tasksGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		tasksGroup.setAttribute('class', 'gantt-tasks');

		let rowIndex = 0;

		for (let projectIndex = 0; projectIndex < state.projects.length; projectIndex++) {
			const project = state.projects[projectIndex];
			this.renderProjectHeader(tasksGroup, project, rowIndex, state, projectIndex);
			rowIndex++;

			// Skip task rows if projectsOnly mode is active or project is collapsed
			if (!state.projectsOnly && !state.collapsedProjects.has(project.id)) {
				rowIndex = this.renderTaskRows(tasksGroup, project.tasks, state, rowIndex, 0);
			}
		}

		this.svg!.appendChild(tasksGroup);
	}

	private renderProjectHeader(group: SVGGElement, project: Project, rowIndex: number, state: TimelineState, projectIndex: number): void {
		const y = this.config.headerHeight + rowIndex * this.config.rowHeight;
		const isSelected = state.selectedProjectId === project.id;

		// Store project row position for drag reorder
		this.projectRowPositions.set(project.id, {
			y: y,
			index: projectIndex
		});

		const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		bg.setAttribute('x', '0');
		bg.setAttribute('y', String(y));
		bg.setAttribute('width', String(this.config.labelWidth));
		bg.setAttribute('height', String(this.config.rowHeight));
		bg.setAttribute('fill', isSelected ? 'var(--interactive-accent)' : 'var(--background-secondary-alt)');
		bg.setAttribute('class', 'project-header');
		bg.setAttribute('data-project-id', project.id);
		group.appendChild(bg);

		// Click handler for project selection
		if (this.onProjectClick) {
			bg.addEventListener('click', (e) => {
				e.stopPropagation();
				e.preventDefault();
				this.onProjectClick!(project.id);
			});
		}

		// Drag handle for project reordering - always create for functionality, conditionally show
		const dragHandle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		dragHandle.setAttribute('x', '6');
		dragHandle.setAttribute('y', String(y + this.config.rowHeight / 2 + 4));
		dragHandle.setAttribute('fill', this.showDragHandles ? (isSelected ? 'var(--text-on-accent)' : 'var(--text-faint)') : 'transparent');
		dragHandle.setAttribute('font-size', '12');
		dragHandle.setAttribute('cursor', 'grab');
		dragHandle.setAttribute('class', 'drag-handle project-drag-handle' + (this.showDragHandles ? '' : ' hidden-handle'));
		dragHandle.setAttribute('data-project-id', project.id);
		dragHandle.textContent = '\u2630'; // ☰ hamburger menu icon
		group.appendChild(dragHandle);

		// Add drag reorder handlers for project
		dragHandle.addEventListener('mousedown', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.startProjectDragReorder(project.id, e);
		});

		// Collapse/expand icon (only if project has tasks and not in projectsOnly mode)
		const hasTasksToToggle = project.flatTasks.length > 0 && !state.projectsOnly;
		const isCollapsed = state.collapsedProjects.has(project.id);

		if (hasTasksToToggle) {
			const collapseIcon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			collapseIcon.setAttribute('x', '22');
			collapseIcon.setAttribute('y', String(y + this.config.rowHeight / 2 + 4));
			collapseIcon.setAttribute('fill', isSelected ? 'var(--text-on-accent)' : 'var(--text-muted)');
			collapseIcon.setAttribute('font-size', '10');
			collapseIcon.setAttribute('cursor', 'pointer');
			collapseIcon.setAttribute('class', 'project-collapse-icon');
			collapseIcon.setAttribute('data-project-id', project.id);
			collapseIcon.textContent = isCollapsed ? '\u25B6' : '\u25BC'; // ▶ or ▼
			group.appendChild(collapseIcon);

			if (this.onProjectToggle) {
				collapseIcon.addEventListener('click', (e) => {
					e.stopPropagation();
					e.preventDefault();
					this.onProjectToggle!(project.id);
				});
			}
		}

		// Project icon
		const iconX = hasTasksToToggle ? 36 : 22;
		const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		icon.setAttribute('x', String(iconX));
		icon.setAttribute('y', String(y + this.config.rowHeight / 2 + 4));
		icon.setAttribute('fill', isSelected ? 'var(--text-on-accent)' : 'var(--text-muted)');
		icon.setAttribute('font-size', '12');
		icon.setAttribute('pointer-events', 'none');
		icon.textContent = project.icon || '📁';
		group.appendChild(icon);

		// Project name (clickable to edit)
		const nameX = hasTasksToToggle ? 56 : 42;
		const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		text.setAttribute('x', String(nameX));
		text.setAttribute('y', String(y + this.config.rowHeight / 2 + 4));
		text.setAttribute('fill', isSelected ? 'var(--text-on-accent)' : 'var(--text-normal)');
		text.setAttribute('font-size', '13');
		text.setAttribute('font-weight', 'bold');
		text.setAttribute('cursor', 'pointer');
		text.setAttribute('class', 'project-name');
		text.setAttribute('data-project-id', project.id);
		text.textContent = project.name;
		group.appendChild(text);

		// Click handler for project name editing
		if (this.onProjectNameClick) {
			text.addEventListener('click', (e) => {
				e.stopPropagation();
				e.preventDefault();
				this.onProjectNameClick!(project.id);
			});
		}

		// Open linked note button (only if project has a linked note)
		if (project.linkedNote && this.onOpenLinkedNote) {
			const noteBtn = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			noteBtn.setAttribute('x', String(this.config.labelWidth - 30));
			noteBtn.setAttribute('y', String(y + this.config.rowHeight / 2 + 4));
			noteBtn.setAttribute('fill', isSelected ? 'var(--text-on-accent)' : 'var(--text-accent)');
			noteBtn.setAttribute('font-size', '12');
			noteBtn.setAttribute('cursor', 'pointer');
			noteBtn.setAttribute('class', 'project-note-btn');
			noteBtn.setAttribute('data-project-id', project.id);
			noteBtn.textContent = '📄';
			group.appendChild(noteBtn);

			const notePath = project.linkedNote;
			noteBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this.onOpenLinkedNote!(notePath);
			});
		}

		// Render project bar (shows project duration based on tasks)
		this.renderProjectBar(group, project, y, state);
	}

	private renderProjectBar(group: SVGGElement, project: Project, y: number, state: TimelineState): void {
		if (project.flatTasks.length === 0) return;

		// Calculate project duration from tasks
		const startDate = project.startDate;
		const endDate = project.endDate;

		const barX = this.dateToX(startDate, state);
		const barEndX = this.dateToX(endDate, state);
		const barWidth = Math.max(barEndX - barX, 8);
		const barY = y + (this.config.rowHeight - this.config.taskBarHeight) / 2;

		// Project bar (slightly transparent, different style)
		const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		bar.setAttribute('x', String(barX));
		bar.setAttribute('y', String(barY));
		bar.setAttribute('width', String(barWidth));
		bar.setAttribute('height', String(this.config.taskBarHeight));
		bar.setAttribute('rx', '4');
		bar.setAttribute('fill', 'var(--interactive-accent)');
		bar.setAttribute('fill-opacity', '0.3');
		bar.setAttribute('stroke', 'var(--interactive-accent)');
		bar.setAttribute('stroke-width', '1.5');
		bar.setAttribute('class', 'project-bar');
		group.appendChild(bar);

		// Project duration text
		const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
		const durationText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		durationText.setAttribute('x', String(barX + barWidth + 8));
		durationText.setAttribute('y', String(barY + this.config.taskBarHeight / 2 + 4));
		durationText.setAttribute('fill', 'var(--text-muted)');
		durationText.setAttribute('font-size', '11');
		durationText.textContent = `${durationDays}d`;
		group.appendChild(durationText);
	}

	private renderTaskRows(
		group: SVGGElement,
		tasks: Task[],
		state: TimelineState,
		startRowIndex: number,
		indentLevel: number
	): number {
		let rowIndex = startRowIndex;

		for (const task of tasks) {
			this.renderTaskRow(group, task, state, rowIndex, indentLevel);
			rowIndex++;

			if (!state.collapsedTasks.has(task.id) && task.children.length > 0) {
				rowIndex = this.renderTaskRows(group, task.children, state, rowIndex, indentLevel + 1);
			}
		}

		return rowIndex;
	}

	private renderTaskRow(
		group: SVGGElement,
		task: Task,
		state: TimelineState,
		rowIndex: number,
		indentLevel: number
	): void {
		const y = this.config.headerHeight + rowIndex * this.config.rowHeight;
		const dragHandleWidth = 18; // Space for drag handle
		const indent = dragHandleWidth + 20 + indentLevel * 20;

		// Store task row position for drag reorder
		this.taskRowPositions.set(task.id, {
			y: y,
			projectId: task.projectId,
			index: task.indexInProject
		});

		// Drag handle (grip icon) - always create for functionality, but conditionally show
		const dragHandle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		dragHandle.setAttribute('x', '6');
		dragHandle.setAttribute('y', String(y + this.config.rowHeight / 2 + 4));
		dragHandle.setAttribute('fill', this.showDragHandles ? 'var(--text-faint)' : 'transparent');
		dragHandle.setAttribute('font-size', '12');
		dragHandle.setAttribute('cursor', 'grab');
		dragHandle.setAttribute('class', 'drag-handle' + (this.showDragHandles ? '' : ' hidden-handle'));
		dragHandle.setAttribute('data-task-id', task.id);
		dragHandle.textContent = '\u2630'; // ☰ hamburger menu icon
		group.appendChild(dragHandle);

		// Add drag reorder handlers
		dragHandle.addEventListener('mousedown', (e) => {
			e.preventDefault();
			this.startDragReorder(task.id, e);
		});

		if (task.children.length > 0) {
			const collapseIcon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			collapseIcon.setAttribute('x', String(indent - 15));
			collapseIcon.setAttribute('y', String(y + this.config.rowHeight / 2 + 4));
			collapseIcon.setAttribute('fill', 'var(--text-muted)');
			collapseIcon.setAttribute('font-size', '12');
			collapseIcon.setAttribute('cursor', 'pointer');
			collapseIcon.setAttribute('class', 'collapse-icon');
			collapseIcon.setAttribute('data-task-id', task.id);
			collapseIcon.textContent = state.collapsedTasks.has(task.id) ? '\u25B6' : '\u25BC';
			group.appendChild(collapseIcon);
		}

		const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		labelText.setAttribute('x', String(indent));
		labelText.setAttribute('y', String(y + this.config.rowHeight / 2 + 4));

		const isCompleted = task.status === 'done' || task.isDone;
		const isCancelled = task.status === 'cancelled';

		labelText.setAttribute('fill', (isCompleted || isCancelled) ? 'var(--text-muted)' : 'var(--text-normal)');
		labelText.setAttribute('font-size', '12');
		labelText.setAttribute('cursor', 'pointer');
		labelText.setAttribute('class', 'task-label');
		labelText.setAttribute('data-task-id', task.id);
		if (isCompleted || isCancelled) {
			labelText.setAttribute('text-decoration', 'line-through');
		}
		labelText.textContent = task.title.length > 25 ? task.title.substring(0, 22) + '...' : task.title;

		// Add click handler for editing task name
		if (this.onTaskLabelClick) {
			labelText.addEventListener('click', () => {
				this.onTaskLabelClick!(task.id, task.title);
			});
		}

		group.appendChild(labelText);

		// Action buttons area (right side of label)
		const actionsX = this.config.labelWidth - 55;

		// Indent button (→) - only if can indent (not first task, level < 3)
		if (task.indexInProject > 0 && task.level < 3) {
			const indentBtn = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			indentBtn.setAttribute('x', String(actionsX));
			indentBtn.setAttribute('y', String(y + this.config.rowHeight / 2 + 4));
			indentBtn.setAttribute('fill', 'var(--text-faint)');
			indentBtn.setAttribute('font-size', '10');
			indentBtn.setAttribute('cursor', 'pointer');
			indentBtn.setAttribute('class', 'task-indent-btn');
			indentBtn.setAttribute('data-task-id', task.id);
			indentBtn.textContent = '→';
			group.appendChild(indentBtn);

			if (this.onTaskIndent) {
				indentBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					this.onTaskIndent!(task.id);
				});
			}
		}

		// Outdent button (←) - only if can outdent (level > 1)
		if (task.level > 1) {
			const outdentBtn = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			outdentBtn.setAttribute('x', String(actionsX + 15));
			outdentBtn.setAttribute('y', String(y + this.config.rowHeight / 2 + 4));
			outdentBtn.setAttribute('fill', 'var(--text-faint)');
			outdentBtn.setAttribute('font-size', '10');
			outdentBtn.setAttribute('cursor', 'pointer');
			outdentBtn.setAttribute('class', 'task-outdent-btn');
			outdentBtn.setAttribute('data-task-id', task.id);
			outdentBtn.textContent = '←';
			group.appendChild(outdentBtn);

			if (this.onTaskOutdent) {
				outdentBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					this.onTaskOutdent!(task.id);
				});
			}
		}

		// Delete button (X)
		const deleteBtn = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		deleteBtn.setAttribute('x', String(actionsX + 35));
		deleteBtn.setAttribute('y', String(y + this.config.rowHeight / 2 + 4));
		deleteBtn.setAttribute('fill', 'var(--text-faint)');
		deleteBtn.setAttribute('font-size', '12');
		deleteBtn.setAttribute('cursor', 'pointer');
		deleteBtn.setAttribute('class', 'task-delete-btn');
		deleteBtn.setAttribute('data-task-id', task.id);
		deleteBtn.textContent = '✕';
		group.appendChild(deleteBtn);

		// Add click handler for delete
		if (this.onTaskDelete) {
			deleteBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this.onTaskDelete!(task.id);
			});
		}

		const barX = this.dateToX(task.startDate, state);
		const barWidth = Math.max(this.durationToWidth(task.duration, state), 10);
		const barY = y + this.config.taskBarMargin;
		const barHeight = this.config.taskBarHeight;

		if (task.isMilestone) {
			this.renderMilestone(group, task, barX, barY + barHeight / 2, state);
		} else {
			this.renderTaskBar(group, task, barX, barY, barWidth, barHeight, state);
		}
	}

	private renderTaskBar(
		group: SVGGElement,
		task: Task,
		x: number,
		y: number,
		width: number,
		height: number,
		state: TimelineState
	): void {
		const taskGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		taskGroup.setAttribute('class', 'task-bar-group');
		taskGroup.setAttribute('data-task-id', task.id);

		const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		bar.setAttribute('x', String(x));
		bar.setAttribute('y', String(y));
		bar.setAttribute('width', String(width));
		bar.setAttribute('height', String(height));
		bar.setAttribute('rx', '4');
		bar.setAttribute('ry', '4');
		bar.setAttribute('fill', task.color || this.getTaskBarColor(task));
		bar.setAttribute('class', 'task-bar');
		bar.setAttribute('cursor', 'grab');

		if (state.selectedTaskId === task.id) {
			bar.setAttribute('stroke', 'var(--text-accent)');
			bar.setAttribute('stroke-width', '2');
		}

		taskGroup.appendChild(bar);

		const leftHandle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		leftHandle.setAttribute('x', String(x));
		leftHandle.setAttribute('y', String(y));
		leftHandle.setAttribute('width', '8');
		leftHandle.setAttribute('height', String(height));
		leftHandle.setAttribute('fill', 'transparent');
		leftHandle.setAttribute('cursor', 'ew-resize');
		leftHandle.setAttribute('class', 'resize-handle resize-handle-left');
		taskGroup.appendChild(leftHandle);

		const rightHandle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		rightHandle.setAttribute('x', String(x + width - 8));
		rightHandle.setAttribute('y', String(y));
		rightHandle.setAttribute('width', '8');
		rightHandle.setAttribute('height', String(height));
		rightHandle.setAttribute('fill', 'transparent');
		rightHandle.setAttribute('cursor', 'ew-resize');
		rightHandle.setAttribute('class', 'resize-handle resize-handle-right');
		taskGroup.appendChild(rightHandle);

		if (this.onTaskClick) {
			bar.addEventListener('click', () => this.onTaskClick!(task.id));
		}

		if (this.onTaskDragStart) {
			bar.addEventListener('mousedown', (e) => {
				if (!(e.target as Element).classList.contains('resize-handle')) {
					this.onTaskDragStart!(task.id, e, 'move');
				}
			});

			leftHandle.addEventListener('mousedown', (e) => {
				e.stopPropagation();
				this.onTaskDragStart!(task.id, e, 'resize-start');
			});

			rightHandle.addEventListener('mousedown', (e) => {
				e.stopPropagation();
				this.onTaskDragStart!(task.id, e, 'resize-end');
			});
		}

		group.appendChild(taskGroup);

		// Task name label next to the bar
		const isCompleted = task.status === 'done' || task.isDone;
		const isCancelled = task.status === 'cancelled';
		const taskNameLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		taskNameLabel.setAttribute('x', String(x + width + 6));
		taskNameLabel.setAttribute('y', String(y + height / 2 + 4));
		taskNameLabel.setAttribute('fill', (isCompleted || isCancelled) ? 'var(--text-faint)' : 'var(--text-muted)');
		taskNameLabel.setAttribute('font-size', '10');
		taskNameLabel.setAttribute('class', 'task-bar-label');
		taskNameLabel.setAttribute('pointer-events', 'none');
		// Truncate long names
		const displayName = task.title.length > 30 ? task.title.substring(0, 27) + '...' : task.title;
		taskNameLabel.textContent = displayName;
		group.appendChild(taskNameLabel);
	}

	private renderMilestone(
		group: SVGGElement,
		task: Task,
		x: number,
		y: number,
		state: TimelineState
	): void {
		const size = 10;
		const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
		const points = [
			`${x},${y - size}`,
			`${x + size},${y}`,
			`${x},${y + size}`,
			`${x - size},${y}`,
		].join(' ');
		diamond.setAttribute('points', points);
		diamond.setAttribute('fill', task.color || this.config.colors.milestone);
		diamond.setAttribute('class', 'milestone');
		diamond.setAttribute('data-task-id', task.id);
		diamond.setAttribute('cursor', 'pointer');

		if (state.selectedTaskId === task.id) {
			diamond.setAttribute('stroke', 'var(--text-accent)');
			diamond.setAttribute('stroke-width', '2');
		}

		if (this.onTaskClick) {
			diamond.addEventListener('click', () => this.onTaskClick!(task.id));
		}

		group.appendChild(diamond);

		// Milestone name label next to the diamond
		const isCompleted = task.status === 'done' || task.isDone;
		const isCancelled = task.status === 'cancelled';
		const milestoneLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		milestoneLabel.setAttribute('x', String(x + size + 6));
		milestoneLabel.setAttribute('y', String(y + 4));
		milestoneLabel.setAttribute('fill', (isCompleted || isCancelled) ? 'var(--text-faint)' : 'var(--text-muted)');
		milestoneLabel.setAttribute('font-size', '10');
		milestoneLabel.setAttribute('class', 'milestone-label');
		milestoneLabel.setAttribute('pointer-events', 'none');
		// Truncate long names
		const displayName = task.title.length > 30 ? task.title.substring(0, 27) + '...' : task.title;
		milestoneLabel.textContent = displayName;
		group.appendChild(milestoneLabel);
	}

	private renderDependencies(state: TimelineState): void {
		const depsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		depsGroup.setAttribute('class', 'gantt-dependencies');

		let rowIndex = 0;
		const taskRowMap = new Map<string, number>();

		for (const project of state.projects) {
			rowIndex++;
			for (const task of project.flatTasks) {
				if (!this.isTaskVisible(task, state.collapsedTasks)) continue;
				taskRowMap.set(task.id, rowIndex);
				rowIndex++;
			}
		}

		for (const project of state.projects) {
			for (const task of project.flatTasks) {
				if (!this.isTaskVisible(task, state.collapsedTasks)) continue;

				for (const depIndex of task.dependencies) {
					const depTaskIndex = depIndex - 1;
					if (depTaskIndex >= 0 && depTaskIndex < project.flatTasks.length) {
						const depTask = project.flatTasks[depTaskIndex];
						if (!this.isTaskVisible(depTask, state.collapsedTasks)) continue;

						const fromRow = taskRowMap.get(depTask.id);
						const toRow = taskRowMap.get(task.id);

						if (fromRow !== undefined && toRow !== undefined) {
							this.renderDependencyLine(depsGroup, depTask, task, fromRow, toRow, state);
						}
					}
				}
			}
		}

		this.svg!.appendChild(depsGroup);
	}

	private renderDependencyLine(
		group: SVGGElement,
		fromTask: Task,
		toTask: Task,
		fromRow: number,
		toRow: number,
		state: TimelineState
	): void {
		const fromX = this.dateToX(fromTask.endDate, state);
		const fromY = this.config.headerHeight + fromRow * this.config.rowHeight + this.config.rowHeight / 2;
		const toX = this.dateToX(toTask.startDate, state);
		const toY = this.config.headerHeight + toRow * this.config.rowHeight + this.config.rowHeight / 2;

		const midX = fromX + 10;

		const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		const d = `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`;
		path.setAttribute('d', d);
		path.setAttribute('stroke', this.config.colors.dependency);
		path.setAttribute('stroke-width', '1.5');
		path.setAttribute('fill', 'none');
		path.setAttribute('marker-end', 'url(#arrowhead)');
		group.appendChild(path);

		if (!this.svg!.querySelector('#arrowhead')) {
			const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
			const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
			marker.setAttribute('id', 'arrowhead');
			marker.setAttribute('markerWidth', '10');
			marker.setAttribute('markerHeight', '7');
			marker.setAttribute('refX', '9');
			marker.setAttribute('refY', '3.5');
			marker.setAttribute('orient', 'auto');

			const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
			polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
			polygon.setAttribute('fill', this.config.colors.dependency);
			marker.appendChild(polygon);
			defs.appendChild(marker);
			this.svg!.insertBefore(defs, this.svg!.firstChild);
		}
	}

	private isTaskVisible(task: Task, collapsed: Set<string>): boolean {
		let parent = task.parent;
		while (parent) {
			if (collapsed.has(parent.id)) return false;
			parent = parent.parent;
		}
		return true;
	}

	private dateToX(date: Date, state: TimelineState): number {
		const days = daysBetween(state.globalStartDate, date);
		const unitWidth = this.getUnitWidth();

		switch (state.zoomLevel) {
			case 'day':
				return this.config.labelWidth + days * unitWidth;
			case 'week':
				return this.config.labelWidth + (days / 7) * unitWidth;
			case 'month':
				return this.config.labelWidth + (days / 30) * unitWidth;
		}
	}

	private durationToWidth(duration: number, state: TimelineState): number {
		const unitWidth = this.getUnitWidth();

		switch (state.zoomLevel) {
			case 'day':
				return duration * unitWidth;
			case 'week':
				return (duration / 7) * unitWidth;
			case 'month':
				return (duration / 30) * unitWidth;
		}
	}

	xToDate(x: number, state: TimelineState): Date {
		const offsetX = x - this.config.labelWidth;
		const unitWidth = this.getUnitWidth();

		let days: number;
		switch (state.zoomLevel) {
			case 'day':
				days = Math.round(offsetX / unitWidth);
				break;
			case 'week':
				days = Math.round((offsetX / unitWidth) * 7);
				break;
			case 'month':
				days = Math.round((offsetX / unitWidth) * 30);
				break;
		}

		return addDays(state.globalStartDate, days);
	}

	widthToDuration(width: number, state: TimelineState): number {
		const unitWidth = this.getUnitWidth();

		switch (state.zoomLevel) {
			case 'day':
				return Math.max(1, Math.round(width / unitWidth));
			case 'week':
				return Math.max(1, Math.round((width / unitWidth) * 7));
			case 'month':
				return Math.max(1, Math.round((width / unitWidth) * 30));
		}
	}

	private getTaskBarColor(task: Task): string {
		switch (task.status) {
			case 'done':
				return this.config.colors.taskBarDone;
			case 'in_progress':
				return this.config.colors.taskBarInProgress;
			case 'cancelled':
				return this.config.colors.taskBarCancelled;
			default:
				// Fallback per compatibilità con vecchio isDone
				if (task.isDone) {
					return this.config.colors.taskBarDone;
				}
				return this.config.colors.taskBar;
		}
	}

	getConfig(): RenderConfig {
		return this.config;
	}

	private startDragReorder(taskId: string, e: MouseEvent): void {
		if (!this.svg || !this.state) return;

		this.dragReorderTaskId = taskId;
		this.dragReorderStartY = e.clientY;

		// Create drop indicator line
		this.dragReorderIndicator = document.createElementNS('http://www.w3.org/2000/svg', 'line');
		this.dragReorderIndicator.setAttribute('x1', '0');
		this.dragReorderIndicator.setAttribute('x2', String(this.config.labelWidth));
		this.dragReorderIndicator.setAttribute('stroke', 'var(--interactive-accent)');
		this.dragReorderIndicator.setAttribute('stroke-width', '3');
		this.dragReorderIndicator.setAttribute('class', 'drag-indicator is-hidden');
		this.svg.appendChild(this.dragReorderIndicator);

		// Add cursor style
		document.body.addClass('is-grabbing');
		this.svg.classList.add('is-reordering');

		const handleMouseMove = (moveEvent: MouseEvent) => {
			this.handleDragReorderMove(moveEvent);
		};

		const handleMouseUp = (upEvent: MouseEvent) => {
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
			this.endDragReorder(upEvent);
		};

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	}

	private handleDragReorderMove(e: MouseEvent): void {
		if (!this.svg || !this.state || !this.dragReorderTaskId || !this.dragReorderIndicator) return;

		const svgRect = this.svg.getBoundingClientRect();
		const mouseY = e.clientY - svgRect.top;

		// Find the task we're dragging
		const draggedTaskPos = this.taskRowPositions.get(this.dragReorderTaskId);
		if (!draggedTaskPos) return;

		// Find where to show the drop indicator (only within same project)
		let closestY = 0;
		let closestIndex = 0;
		let targetProjectId = draggedTaskPos.projectId;
		let minDist = Infinity;
		let foundValidTarget = false;

		this.taskRowPositions.forEach((pos, taskId) => {
			// Only allow reordering within the same project
			if (pos.projectId !== draggedTaskPos.projectId) return;

			foundValidTarget = true;
			const taskY = pos.y;

			// Check top of task row
			const distTop = Math.abs(mouseY - taskY);
			if (distTop < minDist) {
				minDist = distTop;
				closestY = taskY;
				closestIndex = pos.index;
				targetProjectId = pos.projectId;
			}

			// Check bottom of task row
			const distBottom = Math.abs(mouseY - (taskY + this.config.rowHeight));
			if (distBottom < minDist) {
				minDist = distBottom;
				closestY = taskY + this.config.rowHeight;
				closestIndex = pos.index + 1;
				targetProjectId = pos.projectId;
			}
		});

		// Only show indicator if we found a valid target in the same project
		// and mouse is reasonably close (within 100px)
		if (foundValidTarget && minDist < 100) {
			this.dragReorderIndicator.setAttribute('y1', String(closestY));
			this.dragReorderIndicator.setAttribute('y2', String(closestY));
			this.dragReorderIndicator.classList.remove('is-hidden');

			// Store target for drop
			this.dragReorderIndicator.setAttribute('data-target-project', targetProjectId);
			this.dragReorderIndicator.setAttribute('data-target-index', String(closestIndex));
		} else {
			// Hide indicator when outside valid drop zone
			this.dragReorderIndicator.classList.add('is-hidden');
			this.dragReorderIndicator.removeAttribute('data-target-project');
			this.dragReorderIndicator.removeAttribute('data-target-index');
		}
	}

	private endDragReorder(e: MouseEvent): void {
		document.body.removeClass('is-grabbing');

		if (this.svg) {
			this.svg.classList.remove('is-reordering');
		}

		if (!this.dragReorderTaskId || !this.dragReorderIndicator) {
			this.cleanupDragReorder();
			return;
		}

		const targetProjectId = this.dragReorderIndicator.getAttribute('data-target-project');
		const targetIndexStr = this.dragReorderIndicator.getAttribute('data-target-index');

		if (targetProjectId && targetIndexStr && this.onTaskReorder) {
			const targetIndex = parseInt(targetIndexStr, 10);
			const draggedTaskPos = this.taskRowPositions.get(this.dragReorderTaskId);

			// Only fire event if position changed
			if (draggedTaskPos && (targetIndex !== draggedTaskPos.index && targetIndex !== draggedTaskPos.index + 1)) {
				this.onTaskReorder(this.dragReorderTaskId, targetProjectId, targetIndex);
			}
		}

		this.cleanupDragReorder();
	}

	private cleanupDragReorder(): void {
		if (this.dragReorderIndicator && this.svg) {
			this.svg.removeChild(this.dragReorderIndicator);
		}
		this.dragReorderTaskId = null;
		this.dragReorderIndicator = null;
		this.dragReorderGhost = null;
	}

	// Project drag reorder methods
	private startProjectDragReorder(projectId: string, e: MouseEvent): void {
		if (!this.svg || !this.state) return;

		this.dragReorderProjectId = projectId;

		// Create drop indicator line
		this.dragReorderIndicator = document.createElementNS('http://www.w3.org/2000/svg', 'line');
		this.dragReorderIndicator.setAttribute('x1', '0');
		this.dragReorderIndicator.setAttribute('x2', String(this.config.labelWidth));
		this.dragReorderIndicator.setAttribute('stroke', 'var(--text-accent)');
		this.dragReorderIndicator.setAttribute('stroke-width', '4');
		this.dragReorderIndicator.setAttribute('class', 'drag-indicator project-drag-indicator is-hidden');
		this.svg.appendChild(this.dragReorderIndicator);

		// Add cursor style
		document.body.addClass('is-grabbing');
		this.svg.classList.add('is-reordering-project');

		const handleMouseMove = (moveEvent: MouseEvent) => {
			this.handleProjectDragReorderMove(moveEvent);
		};

		const handleMouseUp = (upEvent: MouseEvent) => {
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
			this.endProjectDragReorder(upEvent);
		};

		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	}

	private handleProjectDragReorderMove(e: MouseEvent): void {
		if (!this.svg || !this.state || !this.dragReorderProjectId || !this.dragReorderIndicator) return;

		const svgRect = this.svg.getBoundingClientRect();
		const mouseY = e.clientY - svgRect.top;

		// Find where to show the drop indicator
		let closestY = 0;
		let closestIndex = 0;
		let minDist = Infinity;

		this.projectRowPositions.forEach((pos, projId) => {
			const projY = pos.y;

			// Check top of project row
			const distTop = Math.abs(mouseY - projY);
			if (distTop < minDist) {
				minDist = distTop;
				closestY = projY;
				closestIndex = pos.index;
			}

			// Check bottom of project row (for last position)
			// We need to estimate where the project ends
			const project = this.state!.projects.find(p => p.id === projId);
			if (project) {
				const projectHeight = (1 + project.flatTasks.length) * this.config.rowHeight;
				const distBottom = Math.abs(mouseY - (projY + projectHeight));
				if (distBottom < minDist) {
					minDist = distBottom;
					closestY = projY + projectHeight;
					closestIndex = pos.index + 1;
				}
			}
		});

		// Show indicator
		if (minDist < 150) {
			this.dragReorderIndicator.setAttribute('y1', String(closestY));
			this.dragReorderIndicator.setAttribute('y2', String(closestY));
			this.dragReorderIndicator.classList.remove('is-hidden');

			// Store target for drop
			this.dragReorderIndicator.setAttribute('data-target-index', String(closestIndex));
		} else {
			this.dragReorderIndicator.classList.add('is-hidden');
			this.dragReorderIndicator.removeAttribute('data-target-index');
		}
	}

	private endProjectDragReorder(e: MouseEvent): void {
		document.body.removeClass('is-grabbing');

		if (this.svg) {
			this.svg.classList.remove('is-reordering-project');
		}

		if (!this.dragReorderProjectId || !this.dragReorderIndicator) {
			this.cleanupProjectDragReorder();
			return;
		}

		const targetIndexStr = this.dragReorderIndicator.getAttribute('data-target-index');

		if (targetIndexStr && this.onProjectReorder) {
			const targetIndex = parseInt(targetIndexStr, 10);
			const draggedProjectPos = this.projectRowPositions.get(this.dragReorderProjectId);

			// Only fire event if position changed
			if (draggedProjectPos && targetIndex !== draggedProjectPos.index && targetIndex !== draggedProjectPos.index + 1) {
				this.onProjectReorder(this.dragReorderProjectId, targetIndex);
			}
		}

		this.cleanupProjectDragReorder();
	}

	private cleanupProjectDragReorder(): void {
		if (this.dragReorderIndicator && this.svg) {
			this.svg.removeChild(this.dragReorderIndicator);
		}
		this.dragReorderProjectId = null;
		this.dragReorderIndicator = null;
	}
}

export const ganttRenderer = new GanttRenderer();
