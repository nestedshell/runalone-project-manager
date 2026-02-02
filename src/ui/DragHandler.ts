import { Task, TimelineState, DragState, Project } from '../core/TaskModel';
import { GanttRenderer } from './GanttRenderer';
import { addDays, daysBetween, cloneDate } from '../utils/DateUtils';

export type DragType = 'move' | 'resize-start' | 'resize-end';

export interface DragCallbacks {
	onDragUpdate: (taskId: string, newStartDate: Date, newDuration: number) => void;
	onDragEnd: (taskId: string, newStartDate: Date, newDuration: number) => void;
}

export class DragHandler {
	private state: DragState = {
		isDragging: false,
		dragType: null,
		taskId: null,
		startX: 0,
		originalStartDate: null,
		originalDuration: null,
	};

	private container: HTMLElement | null = null;
	private renderer: GanttRenderer | null = null;
	private timelineState: TimelineState | null = null;
	private callbacks: DragCallbacks | null = null;

	private boundMouseMove: ((e: MouseEvent) => void) | null = null;
	private boundMouseUp: ((e: MouseEvent) => void) | null = null;

	initialize(
		container: HTMLElement,
		renderer: GanttRenderer,
		state: TimelineState,
		callbacks: DragCallbacks
	): void {
		this.container = container;
		this.renderer = renderer;
		this.timelineState = state;
		this.callbacks = callbacks;

		this.boundMouseMove = this.handleMouseMove.bind(this);
		this.boundMouseUp = this.handleMouseUp.bind(this);
	}

	updateState(state: TimelineState): void {
		this.timelineState = state;
	}

	startDrag(taskId: string, e: MouseEvent, dragType: DragType): void {
		if (!this.timelineState || !this.container) return;

		const task = this.findTask(taskId);
		if (!task) return;

		this.state = {
			isDragging: true,
			dragType,
			taskId,
			startX: e.clientX,
			originalStartDate: cloneDate(task.startDate),
			originalDuration: task.duration,
		};

		document.addEventListener('mousemove', this.boundMouseMove!);
		document.addEventListener('mouseup', this.boundMouseUp!);

		this.container.style.cursor = dragType === 'move' ? 'grabbing' : 'ew-resize';
		document.body.style.userSelect = 'none';

		e.preventDefault();
	}

	private handleMouseMove(e: MouseEvent): void {
		if (!this.state.isDragging || !this.renderer || !this.timelineState || !this.callbacks) return;

		const deltaX = e.clientX - this.state.startX;
		const config = this.renderer.getConfig();

		let unitWidth: number;
		switch (this.timelineState.zoomLevel) {
			case 'day':
				unitWidth = config.dayWidth;
				break;
			case 'week':
				unitWidth = config.weekWidth / 7;
				break;
			case 'month':
				unitWidth = config.monthWidth / 30;
				break;
		}

		const deltaDays = Math.round(deltaX / unitWidth);

		let newStartDate = this.state.originalStartDate!;
		let newDuration = this.state.originalDuration!;

		switch (this.state.dragType) {
			case 'move':
				newStartDate = addDays(this.state.originalStartDate!, deltaDays);
				break;

			case 'resize-start':
				newStartDate = addDays(this.state.originalStartDate!, deltaDays);
				newDuration = Math.max(1, this.state.originalDuration! - deltaDays);
				break;

			case 'resize-end':
				newDuration = Math.max(1, this.state.originalDuration! + deltaDays);
				break;
		}

		this.callbacks.onDragUpdate(this.state.taskId!, newStartDate, newDuration);

		this.updateVisualFeedback(newStartDate, newDuration);
	}

	private handleMouseUp(e: MouseEvent): void {
		if (!this.state.isDragging || !this.callbacks || !this.renderer || !this.timelineState) return;

		const deltaX = e.clientX - this.state.startX;
		const config = this.renderer.getConfig();

		let unitWidth: number;
		switch (this.timelineState.zoomLevel) {
			case 'day':
				unitWidth = config.dayWidth;
				break;
			case 'week':
				unitWidth = config.weekWidth / 7;
				break;
			case 'month':
				unitWidth = config.monthWidth / 30;
				break;
		}

		const deltaDays = Math.round(deltaX / unitWidth);

		let newStartDate = this.state.originalStartDate!;
		let newDuration = this.state.originalDuration!;

		switch (this.state.dragType) {
			case 'move':
				newStartDate = addDays(this.state.originalStartDate!, deltaDays);
				break;

			case 'resize-start':
				newStartDate = addDays(this.state.originalStartDate!, deltaDays);
				newDuration = Math.max(1, this.state.originalDuration! - deltaDays);
				break;

			case 'resize-end':
				newDuration = Math.max(1, this.state.originalDuration! + deltaDays);
				break;
		}

		this.callbacks.onDragEnd(this.state.taskId!, newStartDate, newDuration);

		this.cleanup();
	}

	private cleanup(): void {
		document.removeEventListener('mousemove', this.boundMouseMove!);
		document.removeEventListener('mouseup', this.boundMouseUp!);

		if (this.container) {
			this.container.style.cursor = '';
		}
		document.body.style.userSelect = '';

		this.state = {
			isDragging: false,
			dragType: null,
			taskId: null,
			startX: 0,
			originalStartDate: null,
			originalDuration: null,
		};
	}

	private updateVisualFeedback(newStartDate: Date, newDuration: number): void {
		if (!this.container || !this.state.taskId) return;

		const taskBar = this.container.querySelector(`[data-task-id="${this.state.taskId}"] .task-bar`);
		if (!taskBar) return;

		taskBar.setAttribute('opacity', '0.7');
	}

	private findTask(taskId: string): Task | null {
		if (!this.timelineState) return null;

		for (const project of this.timelineState.projects) {
			const task = project.flatTasks.find(t => t.id === taskId);
			if (task) return task;
		}
		return null;
	}

	isDragging(): boolean {
		return this.state.isDragging;
	}

	getDragState(): DragState {
		return { ...this.state };
	}

	destroy(): void {
		this.cleanup();
		this.container = null;
		this.renderer = null;
		this.timelineState = null;
		this.callbacks = null;
	}
}

export const dragHandler = new DragHandler();
