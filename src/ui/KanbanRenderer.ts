import { Task, Project, TimelineState, TaskStatus } from '../core/TaskModel';

export interface KanbanCallbacks {
	onTaskStatusChange: (taskId: string, newStatus: TaskStatus) => void;
	onTaskClick: (taskId: string) => void;
}

const STATUS_CONFIG: { status: TaskStatus; title: string; color: string }[] = [
	{ status: 'pending', title: 'To Do', color: '#6b7280' },
	{ status: 'in_progress', title: 'In Progress', color: '#3b82f6' },
	{ status: 'done', title: 'Done', color: '#22c55e' },
	{ status: 'cancelled', title: 'Cancelled', color: '#ef4444' },
];

export class KanbanRenderer {
	private callbacks: KanbanCallbacks | null = null;
	private draggedTaskId: string | null = null;

	setCallbacks(callbacks: KanbanCallbacks): void {
		this.callbacks = callbacks;
	}

	render(container: HTMLElement, state: TimelineState): void {
		container.empty();

		// Main kanban board
		const board = document.createElement('div');
		board.className = 'kanban-board';
		container.appendChild(board);

		// Create each column
		for (const config of STATUS_CONFIG) {
			const column = this.createColumn(config, state);
			board.appendChild(column);
		}
	}

	private createColumn(
		config: { status: TaskStatus; title: string; color: string },
		state: TimelineState
	): HTMLElement {
		const column = document.createElement('div');
		column.className = 'kanban-column';
		column.dataset.status = config.status;

		// Header
		const header = document.createElement('div');
		header.className = 'kanban-header';

		const dot = document.createElement('span');
		dot.className = 'kanban-dot';
		dot.style.backgroundColor = config.color;
		header.appendChild(dot);

		const title = document.createElement('span');
		title.className = 'kanban-title';
		title.textContent = config.title;
		header.appendChild(title);

		// Count
		const count = this.countTasks(state.projects, config.status);
		const countEl = document.createElement('span');
		countEl.className = 'kanban-count';
		countEl.textContent = String(count);
		header.appendChild(countEl);

		column.appendChild(header);

		// Cards container
		const cards = document.createElement('div');
		cards.className = 'kanban-cards';

		// Add tasks
		for (const project of state.projects) {
			for (const task of project.flatTasks) {
				if (task.status === config.status) {
					const card = this.createCard(task, project, state);
					cards.appendChild(card);
				}
			}
		}

		column.appendChild(cards);

		// Drop zone setup
		this.setupDropZone(column, config.status);

		return column;
	}

	private createCard(task: Task, project: Project, state: TimelineState): HTMLElement {
		const card = document.createElement('div');
		card.className = 'kanban-card';
		card.dataset.taskId = task.id;
		card.draggable = true;

		if (state.selectedTaskId === task.id) {
			card.classList.add('selected');
		}

		// Project badge
		const badge = document.createElement('div');
		badge.className = 'kanban-badge';
		badge.textContent = project.icon ? `${project.icon} ${project.name}` : project.name;
		card.appendChild(badge);

		// Task title
		const titleEl = document.createElement('div');
		titleEl.className = 'kanban-card-title';
		if (task.isMilestone) {
			titleEl.innerHTML = `<span class="milestone-icon">&#9670;</span> ${task.title}`;
		} else {
			titleEl.textContent = task.title;
		}
		card.appendChild(titleEl);

		// Meta row
		const meta = document.createElement('div');
		meta.className = 'kanban-meta';

		// Duration
		const duration = document.createElement('span');
		duration.className = 'kanban-meta-item';
		duration.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> ${task.duration}d`;
		meta.appendChild(duration);

		// Dependencies
		if (task.dependencies.length > 0) {
			const deps = document.createElement('span');
			deps.className = 'kanban-meta-item';
			deps.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> ${task.dependencies.length}`;
			meta.appendChild(deps);
		}

		card.appendChild(meta);

		// Color indicator
		if (task.color) {
			card.style.borderLeftColor = task.color;
			card.style.borderLeftWidth = '4px';
		}

		// Drag events
		card.addEventListener('dragstart', (e) => {
			this.draggedTaskId = task.id;
			card.classList.add('dragging');
			if (e.dataTransfer) {
				e.dataTransfer.effectAllowed = 'move';
				e.dataTransfer.setData('text/plain', task.id);
			}
		});

		card.addEventListener('dragend', () => {
			card.classList.remove('dragging');
			this.draggedTaskId = null;
			document.querySelectorAll('.kanban-column').forEach(col => {
				col.classList.remove('drop-target');
			});
		});

		// Click event
		card.addEventListener('click', () => {
			if (this.callbacks) {
				this.callbacks.onTaskClick(task.id);
			}
		});

		return card;
	}

	private setupDropZone(column: HTMLElement, status: TaskStatus): void {
		column.addEventListener('dragover', (e) => {
			e.preventDefault();
			if (e.dataTransfer) {
				e.dataTransfer.dropEffect = 'move';
			}
			column.classList.add('drop-target');
		});

		column.addEventListener('dragleave', (e) => {
			const related = e.relatedTarget as HTMLElement;
			if (!column.contains(related)) {
				column.classList.remove('drop-target');
			}
		});

		column.addEventListener('drop', (e) => {
			e.preventDefault();
			column.classList.remove('drop-target');

			if (this.draggedTaskId && this.callbacks) {
				this.callbacks.onTaskStatusChange(this.draggedTaskId, status);
			}
		});
	}

	private countTasks(projects: Project[], status: TaskStatus): number {
		let count = 0;
		for (const project of projects) {
			for (const task of project.flatTasks) {
				if (task.status === status) count++;
			}
		}
		return count;
	}

	destroy(): void {
		this.callbacks = null;
		this.draggedTaskId = null;
	}
}
