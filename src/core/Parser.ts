import { ParseResult, ParsedProject, ParsedTask, TaskStatus } from './TaskModel';

const START_DATE_REGEX = /^@start:\s*(\d{4}-\d{2}-\d{2})/m;
const PROJECT_HEADER_REGEX = /^##\s+(.+)$/;
// Regex to extract emoji icon at the start of project name
const PROJECT_ICON_REGEX = /^([\p{Emoji_Presentation}\p{Extended_Pictographic}])\s*(.+)$/u;
// Regex to extract @note from project header (supports quoted names with spaces)
const PROJECT_NOTE_REGEX = /@note:(?:"([^"]+)"|(\S+))/;
const TASK_REGEX = /^(>+)\s+(.+?)\s*\((\d+)\)(.*)$/;
const MODIFIER_REGEX = /@(\w+)(?::(?:"([^"]+)"|([^\s@]+)))?/g;

export class Parser {
	parse(content: string): ParseResult {
		const lines = content.split('\n');
		const globalStartDate = this.parseGlobalStartDate(content);
		const projects: ParsedProject[] = [];

		let currentProject: ParsedProject | null = null;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const lineNumber = i + 1;

			const projectMatch = line.match(PROJECT_HEADER_REGEX);
			if (projectMatch) {
				if (currentProject) {
					projects.push(currentProject);
				}

				// Extract icon and name
				let headerContent = projectMatch[1].trim();

				// Extract linked note if present
				let linkedNote: string | undefined;
				const noteMatch = headerContent.match(PROJECT_NOTE_REGEX);
				if (noteMatch) {
					// noteMatch[1] is quoted name, noteMatch[2] is unquoted name
					linkedNote = noteMatch[1] || noteMatch[2];
					// Remove @note:xxx or @note:"xxx" from headerContent
					headerContent = headerContent.replace(PROJECT_NOTE_REGEX, '').trim();
				}

				const iconMatch = headerContent.match(PROJECT_ICON_REGEX);

				let icon = '📁'; // Default icon
				let name = headerContent;

				if (iconMatch) {
					icon = iconMatch[1];
					name = iconMatch[2].trim();
				}

				currentProject = {
					name,
					icon,
					linkedNote,
					tasks: [],
					lineNumber,
				};
				continue;
			}

			const taskMatch = line.match(TASK_REGEX);
			if (taskMatch && currentProject) {
				const task = this.parseTaskLine(taskMatch, lineNumber);
				currentProject.tasks.push(task);
			}
		}

		if (currentProject) {
			projects.push(currentProject);
		}

		return {
			globalStartDate,
			projects,
		};
	}

	private parseGlobalStartDate(content: string): Date {
		const match = content.match(START_DATE_REGEX);
		if (match) {
			return new Date(match[1]);
		}
		return new Date();
	}

	private parseTaskLine(match: RegExpMatchArray, lineNumber: number): ParsedTask {
		const level = match[1].length;
		const title = match[2].trim();
		const duration = parseInt(match[3], 10);
		const modifiersStr = match[4] || '';

		const modifiers = this.parseModifiers(modifiersStr);

		return {
			level,
			title,
			duration,
			dependencies: modifiers.dependencies,
			isMilestone: modifiers.isMilestone,
			isDone: modifiers.isDone,
			status: modifiers.status,
			color: modifiers.color,
			explicitStartDate: modifiers.explicitStartDate,
			linkedNote: modifiers.linkedNote,
			lineNumber,
		};
	}

	private parseModifiers(str: string): {
		dependencies: number[];
		isMilestone: boolean;
		isDone: boolean;
		status: TaskStatus;
		color?: string;
		explicitStartDate?: Date;
		linkedNote?: string;
	} {
		const dependencies: number[] = [];
		let isMilestone = false;
		let isDone = false;
		let status: TaskStatus = 'pending';
		let color: string | undefined;
		let explicitStartDate: Date | undefined;
		let linkedNote: string | undefined;

		let match;
		while ((match = MODIFIER_REGEX.exec(str)) !== null) {
			const [, key, quotedValue, unquotedValue] = match;
			const value = quotedValue || unquotedValue;
			switch (key) {
				case 'after':
					if (value) {
						const depIndex = parseInt(value, 10);
						if (!isNaN(depIndex)) {
							dependencies.push(depIndex);
						}
					}
					break;
				case 'milestone':
					isMilestone = true;
					break;
				case 'done':
					isDone = true;
					status = 'done';
					break;
				case 'progress':
					status = 'in_progress';
					break;
				case 'cancelled':
					status = 'cancelled';
					break;
				case 'color':
					if (value) {
						color = value.startsWith('#') ? value : `#${value}`;
					}
					break;
				case 'start':
					if (value) {
						const parsed = new Date(value);
						if (!isNaN(parsed.getTime())) {
							explicitStartDate = parsed;
						}
					}
					break;
				case 'note':
					if (value) {
						linkedNote = value;
					}
					break;
			}
		}

		return { dependencies, isMilestone, isDone, status, color, explicitStartDate, linkedNote };
	}

	serializeTask(task: ParsedTask): string {
		let line = '>'.repeat(task.level) + ' ' + task.title + ' (' + task.duration + ')';

		if (task.dependencies.length > 0) {
			for (const dep of task.dependencies) {
				line += ` @after:${dep}`;
			}
		}

		if (task.explicitStartDate) {
			const dateStr = task.explicitStartDate.toISOString().split('T')[0];
			line += ` @start:${dateStr}`;
		}

		if (task.isMilestone) {
			line += ' @milestone';
		}

		if (task.status === 'done' || task.isDone) {
			line += ' @done';
		} else if (task.status === 'in_progress') {
			line += ' @progress';
		} else if (task.status === 'cancelled') {
			line += ' @cancelled';
		}

		if (task.color) {
			line += ` @color:${task.color.replace('#', '')}`;
		}

		if (task.linkedNote) {
			const noteRef = task.linkedNote.includes(' ')
				? `"${task.linkedNote}"`
				: task.linkedNote;
			line += ` @note:${noteRef}`;
		}

		return line;
	}

	updateTaskInContent(
		content: string,
		lineNumber: number,
		updates: Partial<Pick<ParsedTask, 'duration' | 'dependencies' | 'explicitStartDate' | 'status'>>
	): string {
		const lines = content.split('\n');
		const lineIndex = lineNumber - 1;

		if (lineIndex < 0 || lineIndex >= lines.length) {
			return content;
		}

		const line = lines[lineIndex];
		const taskMatch = line.match(TASK_REGEX);

		if (!taskMatch) {
			return content;
		}

		const existingTask = this.parseTaskLine(taskMatch, lineNumber);

		const updatedTask: ParsedTask = {
			...existingTask,
			...updates,
		};

		lines[lineIndex] = this.serializeTask(updatedTask);

		return lines.join('\n');
	}

	updateTaskTitleInContent(
		content: string,
		lineNumber: number,
		newTitle: string
	): string {
		const lines = content.split('\n');
		const lineIndex = lineNumber - 1;

		if (lineIndex < 0 || lineIndex >= lines.length) {
			return content;
		}

		const line = lines[lineIndex];
		const taskMatch = line.match(TASK_REGEX);

		if (!taskMatch) {
			return content;
		}

		const existingTask = this.parseTaskLine(taskMatch, lineNumber);

		const updatedTask: ParsedTask = {
			...existingTask,
			title: newTitle,
		};

		lines[lineIndex] = this.serializeTask(updatedTask);

		return lines.join('\n');
	}

	updateTaskFullInContent(
		content: string,
		lineNumber: number,
		updates: {
			title?: string;
			duration?: number;
			startDate?: Date;
			isMilestone?: boolean;
			status?: TaskStatus;
			linkedNote?: string;
		}
	): string {
		const lines = content.split('\n');
		const lineIndex = lineNumber - 1;

		if (lineIndex < 0 || lineIndex >= lines.length) {
			return content;
		}

		const line = lines[lineIndex];
		const taskMatch = line.match(TASK_REGEX);

		if (!taskMatch) {
			return content;
		}

		const existingTask = this.parseTaskLine(taskMatch, lineNumber);

		const updatedTask: ParsedTask = {
			...existingTask,
		};

		if (updates.title !== undefined) {
			updatedTask.title = updates.title;
		}
		if (updates.duration !== undefined) {
			updatedTask.duration = updates.duration;
		}
		if (updates.startDate !== undefined) {
			updatedTask.explicitStartDate = updates.startDate;
		}
		if (updates.isMilestone !== undefined) {
			updatedTask.isMilestone = updates.isMilestone;
		}
		if (updates.status !== undefined) {
			updatedTask.status = updates.status;
			updatedTask.isDone = updates.status === 'done';
		}
		if (updates.linkedNote !== undefined) {
			updatedTask.linkedNote = updates.linkedNote || undefined;
		}

		lines[lineIndex] = this.serializeTask(updatedTask);

		return lines.join('\n');
	}

	updateTaskStatusInContent(
		content: string,
		lineNumber: number,
		newStatus: TaskStatus
	): string {
		return this.updateTaskFullInContent(content, lineNumber, { status: newStatus });
	}
}

export const parser = new Parser();
