import {
	Task,
	Project,
	ParseResult,
	ParsedTask,
	ParsedProject,
	Conflict,
	generateTaskId,
	generateProjectId,
} from './TaskModel';
import { addDays, maxDate, minDate, cloneDate } from '../utils/DateUtils';

export class TimelineCalculator {
	calculate(parseResult: ParseResult): {
		projects: Project[];
		conflicts: Conflict[];
		globalEndDate: Date;
	} {
		const projects: Project[] = [];
		const conflicts: Conflict[] = [];

		let globalEndDate = cloneDate(parseResult.globalStartDate);

		parseResult.projects.forEach((parsedProject, projectIndex) => {
			const projectId = generateProjectId(projectIndex);
			const project = this.calculateProject(
				parsedProject,
				projectId,
				parseResult.globalStartDate
			);

			const projectConflicts = this.detectConflicts(project);
			conflicts.push(...projectConflicts);

			projects.push(project);

			if (project.endDate > globalEndDate) {
				globalEndDate = cloneDate(project.endDate);
			}
		});

		return { projects, conflicts, globalEndDate };
	}

	private calculateProject(
		parsed: ParsedProject,
		projectId: string,
		globalStartDate: Date
	): Project {
		const flatTasks: Task[] = [];
		const rootTasks: Task[] = [];
		const taskStack: Task[] = [];

		parsed.tasks.forEach((parsedTask, index) => {
			const task = this.createTask(parsedTask, projectId, index);
			flatTasks.push(task);

			while (taskStack.length > 0 && taskStack[taskStack.length - 1].level >= task.level) {
				taskStack.pop();
			}

			if (taskStack.length > 0) {
				const parent = taskStack[taskStack.length - 1];
				task.parent = parent;
				parent.children.push(task);
			} else {
				rootTasks.push(task);
			}

			taskStack.push(task);
		});

		this.calculateDates(flatTasks, globalStartDate);

		const projectStartDate = flatTasks.length > 0
			? minDate(...flatTasks.map(t => t.startDate))
			: globalStartDate;

		const projectEndDate = flatTasks.length > 0
			? maxDate(...flatTasks.map(t => t.endDate))
			: globalStartDate;

		return {
			id: projectId,
			name: parsed.name,
			icon: parsed.icon,
			linkedNote: parsed.linkedNote,
			tasks: rootTasks,
			flatTasks,
			startDate: projectStartDate,
			endDate: projectEndDate,
			lineNumber: parsed.lineNumber,
		};
	}

	private createTask(parsed: ParsedTask, projectId: string, index: number): Task {
		return {
			id: generateTaskId(projectId, index),
			level: parsed.level,
			title: parsed.title,
			duration: parsed.duration,
			startDate: new Date(),
			endDate: new Date(),
			dependencies: parsed.dependencies,
			isMilestone: parsed.isMilestone,
			isDone: parsed.isDone,
			status: parsed.status,
			color: parsed.color,
			explicitStartDate: parsed.explicitStartDate,
			manuallyPositioned: !!parsed.explicitStartDate,
			children: [],
			parent: null,
			lineNumber: parsed.lineNumber,
			projectId,
			indexInProject: index,
		};
	}

	private calculateDates(tasks: Task[], globalStartDate: Date): void {
		const resolved = new Set<number>();
		const resolving = new Set<number>();

		const resolveTask = (index: number): void => {
			if (resolved.has(index)) return;
			if (resolving.has(index)) return;

			resolving.add(index);

			const task = tasks[index];

			// Se ha una data di inizio esplicita, usala
			if (task.explicitStartDate && task.manuallyPositioned) {
				task.startDate = cloneDate(task.explicitStartDate);
				task.endDate = addDays(task.startDate, task.duration);
				resolving.delete(index);
				resolved.add(index);
				return;
			}

			let startDate = cloneDate(globalStartDate);

			// Prima risolvi le dipendenze esplicite (@after)
			for (const depIndex of task.dependencies) {
				const depTaskIndex = depIndex - 1;
				if (depTaskIndex >= 0 && depTaskIndex < tasks.length) {
					resolveTask(depTaskIndex);
					const depTask = tasks[depTaskIndex];
					if (depTask.endDate > startDate) {
						startDate = cloneDate(depTask.endDate);
					}
				}
			}

			// Se è un child, controlla il sibling precedente per posizionamento sequenziale
			if (task.parent) {
				const parentIndex = tasks.indexOf(task.parent);
				if (parentIndex >= 0) {
					resolveTask(parentIndex);

					// Trova il sibling precedente allo stesso livello
					const siblingIndex = this.findPreviousSibling(tasks, index, task);
					if (siblingIndex >= 0 && !task.manuallyPositioned) {
						// Posiziona dopo il sibling precedente (sequenziale)
						resolveTask(siblingIndex);
						const prevSibling = tasks[siblingIndex];
						if (prevSibling.endDate > startDate) {
							startDate = cloneDate(prevSibling.endDate);
						}
					} else if (task.parent.startDate > startDate) {
						// Se è il primo child, inizia con il parent
						startDate = cloneDate(task.parent.startDate);
					}
				}
			}

			task.startDate = startDate;
			task.endDate = addDays(startDate, task.duration);

			resolving.delete(index);
			resolved.add(index);
		};

		for (let i = 0; i < tasks.length; i++) {
			resolveTask(i);
		}

		this.adjustParentDates(tasks);
	}

	private findPreviousSibling(tasks: Task[], currentIndex: number, currentTask: Task): number {
		if (!currentTask.parent) return -1;

		// Cerca indietro per trovare il sibling precedente con lo stesso parent
		for (let i = currentIndex - 1; i >= 0; i--) {
			const candidate = tasks[i];
			if (candidate.parent === currentTask.parent && candidate.level === currentTask.level) {
				return i;
			}
			// Se troviamo un task con livello inferiore, abbiamo superato i sibling
			if (candidate.level < currentTask.level) {
				break;
			}
		}
		return -1;
	}

	private adjustParentDates(tasks: Task[]): void {
		const rootTasks = tasks.filter(t => !t.parent);

		const adjustRecursive = (task: Task): void => {
			if (task.children.length === 0) return;

			for (const child of task.children) {
				adjustRecursive(child);
			}

			const childStartDates = task.children.map(c => c.startDate);
			const childEndDates = task.children.map(c => c.endDate);

			const earliestChildStart = minDate(...childStartDates);
			const latestChildEnd = maxDate(...childEndDates);

			// Update parent's start and end dates to span all children
			task.startDate = earliestChildStart;
			task.endDate = latestChildEnd;

			// Calculate duration as days between start and end
			const durationMs = task.endDate.getTime() - task.startDate.getTime();
			const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));
			task.duration = Math.max(1, durationDays);
		};

		for (const root of rootTasks) {
			adjustRecursive(root);
		}
	}

	// Get all parent tasks that need their duration updated
	getParentTasksToUpdate(tasks: Task[], changedTask: Task): Task[] {
		const parentsToUpdate: Task[] = [];
		let current = changedTask.parent;

		while (current) {
			parentsToUpdate.push(current);
			current = current.parent;
		}

		return parentsToUpdate;
	}

	private detectConflicts(project: Project): Conflict[] {
		const conflicts: Conflict[] = [];

		for (const task of project.flatTasks) {
			for (const depIndex of task.dependencies) {
				const depTaskIndex = depIndex - 1;
				if (depTaskIndex >= 0 && depTaskIndex < project.flatTasks.length) {
					const depTask = project.flatTasks[depTaskIndex];
					if (task.startDate < depTask.endDate) {
						conflicts.push({
							taskId: task.id,
							type: 'dependency_violation',
							message: `"${task.title}" starts before "${depTask.title}" ends`,
							relatedTaskIds: [depTask.id],
						});
					}
				}
			}
		}

		return conflicts;
	}

	recalculateFromDrag(
		projects: Project[],
		taskId: string,
		newStartDate: Date,
		newDuration?: number
	): {
		projects: Project[];
		updatedTask: Task | null;
	} {
		const projectsCopy = this.deepCopyProjects(projects);
		let updatedTask: Task | null = null;

		for (const project of projectsCopy) {
			const task = project.flatTasks.find(t => t.id === taskId);
			if (task) {
				task.startDate = newStartDate;
				task.explicitStartDate = cloneDate(newStartDate);
				task.manuallyPositioned = true;
				if (newDuration !== undefined) {
					task.duration = newDuration;
				}
				task.endDate = addDays(task.startDate, task.duration);
				updatedTask = task;

				this.propagateDependencyChanges(project, task);
				this.adjustParentDates(project.flatTasks);

				project.startDate = minDate(...project.flatTasks.map(t => t.startDate));
				project.endDate = maxDate(...project.flatTasks.map(t => t.endDate));

				break;
			}
		}

		return { projects: projectsCopy, updatedTask };
	}

	private propagateDependencyChanges(project: Project, changedTask: Task): void {
		const changedIndex = changedTask.indexInProject + 1;

		for (const task of project.flatTasks) {
			if (task.dependencies.includes(changedIndex)) {
				if (task.startDate < changedTask.endDate) {
					task.startDate = cloneDate(changedTask.endDate);
					task.endDate = addDays(task.startDate, task.duration);
					this.propagateDependencyChanges(project, task);
				}
			}
		}
	}

	private deepCopyProjects(projects: Project[]): Project[] {
		return projects.map(project => ({
			...project,
			startDate: cloneDate(project.startDate),
			endDate: cloneDate(project.endDate),
			flatTasks: project.flatTasks.map(task => ({
				...task,
				startDate: cloneDate(task.startDate),
				endDate: cloneDate(task.endDate),
				explicitStartDate: task.explicitStartDate ? cloneDate(task.explicitStartDate) : undefined,
				dependencies: [...task.dependencies],
				children: [],
				parent: null,
			})),
			tasks: [],
		})).map(project => {
			this.rebuildHierarchy(project);
			return project;
		});
	}

	private rebuildHierarchy(project: Project): void {
		const taskStack: Task[] = [];

		for (const task of project.flatTasks) {
			while (taskStack.length > 0 && taskStack[taskStack.length - 1].level >= task.level) {
				taskStack.pop();
			}

			if (taskStack.length > 0) {
				const parent = taskStack[taskStack.length - 1];
				task.parent = parent;
				parent.children.push(task);
			} else {
				project.tasks.push(task);
			}

			taskStack.push(task);
		}
	}
}

export const timelineCalculator = new TimelineCalculator();
