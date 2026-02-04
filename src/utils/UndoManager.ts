import { Project, Task } from '../core/TaskModel';
import { cloneDate } from './DateUtils';

export interface UndoableAction {
	type: 'task_move' | 'task_resize' | 'task_edit';
	taskId: string;
	before: {
		startDate: Date;
		duration: number;
	};
	after: {
		startDate: Date;
		duration: number;
	};
}

export class UndoManager {
	private undoStack: UndoableAction[] = [];
	private redoStack: UndoableAction[] = [];
	private maxStackSize = 50;
	private onStateChange: (() => void) | null = null;

	setOnStateChange(callback: () => void): void {
		this.onStateChange = callback;
	}

	pushAction(action: UndoableAction): void {
		this.undoStack.push(action);

		if (this.undoStack.length > this.maxStackSize) {
			this.undoStack.shift();
		}

		this.redoStack = [];

		this.notifyStateChange();
	}

	undo(): UndoableAction | null {
		const action = this.undoStack.pop();
		if (!action) return null;

		this.redoStack.push(action);
		this.notifyStateChange();

		return action;
	}

	redo(): UndoableAction | null {
		const action = this.redoStack.pop();
		if (!action) return null;

		this.undoStack.push(action);
		this.notifyStateChange();

		return action;
	}

	canUndo(): boolean {
		return this.undoStack.length > 0;
	}

	canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	clear(): void {
		this.undoStack = [];
		this.redoStack = [];
		this.notifyStateChange();
	}

	private notifyStateChange(): void {
		if (this.onStateChange) {
			this.onStateChange();
		}
	}

	getUndoStackSize(): number {
		return this.undoStack.length;
	}

	getRedoStackSize(): number {
		return this.redoStack.length;
	}

	destroy(): void {
		this.clear();
		this.onStateChange = null;
	}
}

export function deepCopyProjects(projects: Project[]): Project[] {
	return projects.map(project => ({
		...project,
		startDate: cloneDate(project.startDate),
		endDate: cloneDate(project.endDate),
		tasks: deepCopyTasks(project.tasks),
		flatTasks: project.flatTasks.map(task => ({
			...task,
			startDate: cloneDate(task.startDate),
			endDate: cloneDate(task.endDate),
			explicitStartDate: task.explicitStartDate ? cloneDate(task.explicitStartDate) : undefined,
			dependencies: [...task.dependencies],
			children: [],
			parent: null,
		})),
	}));
}

function deepCopyTasks(tasks: Task[]): Task[] {
	return tasks.map(task => ({
		...task,
		startDate: cloneDate(task.startDate),
		endDate: cloneDate(task.endDate),
		explicitStartDate: task.explicitStartDate ? cloneDate(task.explicitStartDate) : undefined,
		dependencies: [...task.dependencies],
		children: deepCopyTasks(task.children),
		parent: null,
	}));
}

export const undoManager = new UndoManager();
