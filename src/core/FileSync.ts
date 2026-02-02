import { App, TFile, Vault } from 'obsidian';
import { Task, Project, TimelineState } from './TaskModel';
import { Parser } from './Parser';
import { daysBetween } from '../utils/DateUtils';

export interface FileSyncCallbacks {
	onFileChanged: () => void;
}

export class FileSync {
	private app: App;
	private parser: Parser;
	private callbacks: FileSyncCallbacks | null = null;
	private watchedFile: TFile | null = null;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private debounceMs = 500;
	private isUpdatingFile = false;

	constructor(app: App) {
		this.app = app;
		this.parser = new Parser();
	}

	setCallbacks(callbacks: FileSyncCallbacks): void {
		this.callbacks = callbacks;
	}

	async watchFile(filePath: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file instanceof TFile) {
			this.watchedFile = file;

			this.app.vault.on('modify', (modifiedFile) => {
				if (modifiedFile === this.watchedFile && !this.isUpdatingFile) {
					this.handleFileModified();
				}
			});
		}
	}

	private handleFileModified(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}

		this.debounceTimer = setTimeout(() => {
			if (this.callbacks) {
				this.callbacks.onFileChanged();
			}
		}, this.debounceMs);
	}

	async readFile(filePath: string): Promise<string | null> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file instanceof TFile) {
			return await this.app.vault.read(file);
		}
		return null;
	}

	async updateTaskDuration(
		filePath: string,
		task: Task,
		newDuration: number
	): Promise<boolean> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return false;

		try {
			this.isUpdatingFile = true;

			const content = await this.app.vault.read(file);
			const updatedContent = this.parser.updateTaskInContent(
				content,
				task.lineNumber,
				{ duration: newDuration }
			);

			await this.app.vault.modify(file, updatedContent);

			return true;
		} catch (error) {
			console.error('Failed to update task duration:', error);
			return false;
		} finally {
			setTimeout(() => {
				this.isUpdatingFile = false;
			}, 100);
		}
	}

	async updateParentDurations(
		filePath: string,
		parentTasks: { lineNumber: number; duration: number }[]
	): Promise<boolean> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return false;

		if (parentTasks.length === 0) return true;

		try {
			this.isUpdatingFile = true;

			let content = await this.app.vault.read(file);

			// Update each parent task's duration
			for (const parent of parentTasks) {
				content = this.parser.updateTaskInContent(
					content,
					parent.lineNumber,
					{ duration: parent.duration }
				);
			}

			await this.app.vault.modify(file, content);

			return true;
		} catch (error) {
			console.error('Failed to update parent durations:', error);
			return false;
		} finally {
			setTimeout(() => {
				this.isUpdatingFile = false;
			}, 100);
		}
	}

	async updateTaskStartDate(
		filePath: string,
		task: Task,
		newStartDate: Date,
		globalStartDate: Date
	): Promise<boolean> {
		const daysDiff = daysBetween(globalStartDate, newStartDate);

		if (task.dependencies.length > 0) {
			return true;
		}

		return true;
	}

	async updateTask(
		filePath: string,
		task: Task,
		updates: {
			duration?: number;
			startDate?: Date;
		},
		globalStartDate: Date
	): Promise<boolean> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return false;

		try {
			this.isUpdatingFile = true;

			const content = await this.app.vault.read(file);

			const parsedUpdates: { duration?: number; dependencies?: number[]; explicitStartDate?: Date } = {};

			if (updates.duration !== undefined) {
				parsedUpdates.duration = updates.duration;
			}

			if (updates.startDate !== undefined) {
				parsedUpdates.explicitStartDate = updates.startDate;
			}

			const updatedContent = this.parser.updateTaskInContent(
				content,
				task.lineNumber,
				parsedUpdates
			);

			await this.app.vault.modify(file, updatedContent);

			return true;
		} catch (error) {
			console.error('Failed to update task:', error);
			return false;
		} finally {
			setTimeout(() => {
				this.isUpdatingFile = false;
			}, 100);
		}
	}

	async createProjectsFile(filePath: string): Promise<boolean> {
		try {
			const existingFile = this.app.vault.getAbstractFileByPath(filePath);
			if (existingFile) {
				return true;
			}

			const today = new Date();
			const dateStr = today.toISOString().split('T')[0];

			const defaultContent = `# My Projects
@start: ${dateStr}

## Sample Project
> Planning phase (5)
> Development (10) @after:1
>> Backend setup (4)
>> Frontend setup (4)
>> Integration (2) @after:1 @after:2
> Testing (5) @after:2
> Deployment (2) @after:3 @milestone
`;

			await this.app.vault.create(filePath, defaultContent);
			return true;
		} catch (error) {
			console.error('Failed to create projects file:', error);
			return false;
		}
	}

	async insertLine(
		filePath: string,
		afterLineNumber: number,
		newLine: string
	): Promise<boolean> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return false;

		try {
			this.isUpdatingFile = true;

			const content = await this.app.vault.read(file);
			const lines = content.split('\n');

			// Insert after the specified line
			lines.splice(afterLineNumber, 0, newLine);

			const updatedContent = lines.join('\n');
			await this.app.vault.modify(file, updatedContent);

			return true;
		} catch (error) {
			console.error('Failed to insert line:', error);
			return false;
		} finally {
			setTimeout(() => {
				this.isUpdatingFile = false;
			}, 100);
		}
	}

	async indentTask(
		filePath: string,
		lineNumber: number
	): Promise<boolean> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return false;

		try {
			this.isUpdatingFile = true;

			const content = await this.app.vault.read(file);
			const lines = content.split('\n');
			const lineIndex = lineNumber - 1;

			if (lineIndex < 0 || lineIndex >= lines.length) {
				return false;
			}

			const line = lines[lineIndex];
			// Check if the line starts with > (task line)
			const taskMatch = line.match(/^(>+)/);
			if (taskMatch) {
				// Add one more > to indent
				lines[lineIndex] = '>' + line;
			}

			const updatedContent = lines.join('\n');
			await this.app.vault.modify(file, updatedContent);

			return true;
		} catch (error) {
			console.error('Failed to indent task:', error);
			return false;
		} finally {
			setTimeout(() => {
				this.isUpdatingFile = false;
			}, 100);
		}
	}

	async outdentTask(
		filePath: string,
		lineNumber: number
	): Promise<boolean> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return false;

		try {
			this.isUpdatingFile = true;

			const content = await this.app.vault.read(file);
			const lines = content.split('\n');
			const lineIndex = lineNumber - 1;

			if (lineIndex < 0 || lineIndex >= lines.length) {
				return false;
			}

			const line = lines[lineIndex];
			// Check if the line starts with >> (at least 2 >)
			const taskMatch = line.match(/^(>>+)/);
			if (taskMatch) {
				// Remove one > to outdent
				lines[lineIndex] = line.substring(1);
			}

			const updatedContent = lines.join('\n');
			await this.app.vault.modify(file, updatedContent);

			return true;
		} catch (error) {
			console.error('Failed to outdent task:', error);
			return false;
		} finally {
			setTimeout(() => {
				this.isUpdatingFile = false;
			}, 100);
		}
	}

	async updateTaskTitle(
		filePath: string,
		lineNumber: number,
		newTitle: string
	): Promise<boolean> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return false;

		try {
			this.isUpdatingFile = true;

			const content = await this.app.vault.read(file);
			const updatedContent = this.parser.updateTaskTitleInContent(
				content,
				lineNumber,
				newTitle
			);

			await this.app.vault.modify(file, updatedContent);

			return true;
		} catch (error) {
			console.error('Failed to update task title:', error);
			return false;
		} finally {
			setTimeout(() => {
				this.isUpdatingFile = false;
			}, 100);
		}
	}

	async updateTaskFull(
		filePath: string,
		lineNumber: number,
		updates: {
			title?: string;
			duration?: number;
			startDate?: Date;
			isMilestone?: boolean;
			status?: 'pending' | 'in_progress' | 'done' | 'cancelled';
		}
	): Promise<boolean> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return false;

		try {
			this.isUpdatingFile = true;

			const content = await this.app.vault.read(file);
			const updatedContent = this.parser.updateTaskFullInContent(
				content,
				lineNumber,
				updates
			);

			await this.app.vault.modify(file, updatedContent);

			return true;
		} catch (error) {
			console.error('Failed to update task:', error);
			return false;
		} finally {
			setTimeout(() => {
				this.isUpdatingFile = false;
			}, 100);
		}
	}

	async updateTaskStatus(
		filePath: string,
		lineNumber: number,
		newStatus: 'pending' | 'in_progress' | 'done' | 'cancelled'
	): Promise<boolean> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return false;

		try {
			this.isUpdatingFile = true;

			const content = await this.app.vault.read(file);
			const updatedContent = this.parser.updateTaskStatusInContent(
				content,
				lineNumber,
				newStatus
			);

			await this.app.vault.modify(file, updatedContent);

			return true;
		} catch (error) {
			console.error('Failed to update task status:', error);
			return false;
		} finally {
			setTimeout(() => {
				this.isUpdatingFile = false;
			}, 100);
		}
	}

	async moveTask(
		filePath: string,
		fromLineNumber: number,
		_targetProjectId: string,
		targetLineNumber: number
	): Promise<boolean> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return false;

		try {
			this.isUpdatingFile = true;

			const content = await this.app.vault.read(file);
			const lines = content.split('\n');
			const fromLineIndex = fromLineNumber - 1;
			let targetLineIndex = targetLineNumber - 1;

			if (fromLineIndex < 0 || fromLineIndex >= lines.length) {
				return false;
			}

			// Get the line to move
			const lineToMove = lines[fromLineIndex];

			// Remove the line from its current position
			lines.splice(fromLineIndex, 1);

			// Adjust target index if we removed a line before it
			if (fromLineIndex < targetLineIndex) {
				targetLineIndex = targetLineIndex - 1;
			}

			// Make sure target is within bounds
			targetLineIndex = Math.max(0, Math.min(targetLineIndex, lines.length));

			// Insert the line at the new position
			lines.splice(targetLineIndex, 0, lineToMove);

			const updatedContent = lines.join('\n');
			await this.app.vault.modify(file, updatedContent);

			return true;
		} catch (error) {
			console.error('Failed to move task:', error);
			return false;
		} finally {
			setTimeout(() => {
				this.isUpdatingFile = false;
			}, 100);
		}
	}

	async deleteTask(
		filePath: string,
		lineNumber: number
	): Promise<boolean> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return false;

		try {
			this.isUpdatingFile = true;

			const content = await this.app.vault.read(file);
			const lines = content.split('\n');
			const lineIndex = lineNumber - 1;

			if (lineIndex < 0 || lineIndex >= lines.length) {
				return false;
			}

			// Remove the line
			lines.splice(lineIndex, 1);

			const updatedContent = lines.join('\n');
			await this.app.vault.modify(file, updatedContent);

			return true;
		} catch (error) {
			console.error('Failed to delete task:', error);
			return false;
		} finally {
			setTimeout(() => {
				this.isUpdatingFile = false;
			}, 100);
		}
	}

	async deleteProject(
		filePath: string,
		projectLineNumber: number,
		nextProjectLineNumber: number | null
	): Promise<boolean> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return false;

		try {
			this.isUpdatingFile = true;

			const content = await this.app.vault.read(file);
			const lines = content.split('\n');

			// Calculate the range of lines to delete (from project header to end of project)
			const fromStart = projectLineNumber - 1;
			const fromEnd = nextProjectLineNumber ? nextProjectLineNumber - 2 : lines.length - 1;

			if (fromStart < 0 || fromStart >= lines.length) {
				return false;
			}

			// Calculate how many lines to remove
			const linesToRemove = fromEnd - fromStart + 1;

			// Remove the lines
			lines.splice(fromStart, linesToRemove);

			const updatedContent = lines.join('\n');
			await this.app.vault.modify(file, updatedContent);

			return true;
		} catch (error) {
			console.error('Failed to delete project:', error);
			return false;
		} finally {
			setTimeout(() => {
				this.isUpdatingFile = false;
			}, 100);
		}
	}

	async updateProject(
		filePath: string,
		lineNumber: number,
		updates: { name?: string; icon?: string; linkedNote?: string }
	): Promise<boolean> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return false;

		try {
			this.isUpdatingFile = true;

			const content = await this.app.vault.read(file);
			const lines = content.split('\n');
			const lineIndex = lineNumber - 1;

			if (lineIndex < 0 || lineIndex >= lines.length) {
				return false;
			}

			// Build the new project header
			const icon = updates.icon || '📁';
			const name = updates.name || 'Project';
			let header = `## ${icon} ${name}`;

			// Add linkedNote if present
			if (updates.linkedNote) {
				header += ` @note:${updates.linkedNote}`;
			}

			lines[lineIndex] = header;

			const updatedContent = lines.join('\n');
			await this.app.vault.modify(file, updatedContent);

			return true;
		} catch (error) {
			console.error('Failed to update project:', error);
			return false;
		} finally {
			setTimeout(() => {
				this.isUpdatingFile = false;
			}, 100);
		}
	}

	async moveProject(
		filePath: string,
		projectLineNumber: number,
		nextProjectLineNumber: number | null,
		targetLineNumber: number
	): Promise<boolean> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return false;

		try {
			this.isUpdatingFile = true;

			const content = await this.app.vault.read(file);
			const lines = content.split('\n');

			// Calculate the range of lines to move (from project header to end of project)
			const fromStart = projectLineNumber - 1;
			const fromEnd = nextProjectLineNumber ? nextProjectLineNumber - 2 : lines.length - 1;

			if (fromStart < 0 || fromStart >= lines.length) {
				return false;
			}

			// Extract the lines to move
			const linesToMove = lines.slice(fromStart, fromEnd + 1);

			// Remove the lines from their current position
			lines.splice(fromStart, linesToMove.length);

			// Calculate adjusted target position
			let adjustedTarget = targetLineNumber - 1;
			if (targetLineNumber - 1 > fromStart) {
				adjustedTarget = adjustedTarget - linesToMove.length;
			}

			// Make sure target is within bounds
			adjustedTarget = Math.max(0, Math.min(adjustedTarget, lines.length));

			// Insert the lines at the new position
			lines.splice(adjustedTarget, 0, ...linesToMove);

			const updatedContent = lines.join('\n');
			await this.app.vault.modify(file, updatedContent);

			return true;
		} catch (error) {
			console.error('Failed to move project:', error);
			return false;
		} finally {
			setTimeout(() => {
				this.isUpdatingFile = false;
			}, 100);
		}
	}

	stopWatching(): void {
		this.watchedFile = null;
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
	}

	destroy(): void {
		this.stopWatching();
		this.callbacks = null;
	}
}
