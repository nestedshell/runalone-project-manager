import { Modal, App, Setting } from 'obsidian';
import { Task, TaskStatus } from '../core/TaskModel';

export interface TaskEditResult {
	title: string;
	duration: number;
	startDate: Date;
	isMilestone: boolean;
	status: TaskStatus;
}

export class TaskEditModal extends Modal {
	private task: Task;
	private onSave: (result: TaskEditResult) => void;

	private titleValue: string;
	private durationValue: number;
	private startDateValue: Date;
	private isMilestoneValue: boolean;
	private statusValue: TaskStatus;

	constructor(app: App, task: Task, onSave: (result: TaskEditResult) => void) {
		super(app);
		this.task = task;
		this.onSave = onSave;

		this.titleValue = task.title;
		this.durationValue = task.duration;
		this.startDateValue = task.startDate;
		this.isMilestoneValue = task.isMilestone;
		this.statusValue = task.status;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.empty();
		contentEl.addClass('task-edit-modal');

		contentEl.createEl('h2', { text: 'Edit Task' });

		// Task Name
		new Setting(contentEl)
			.setName('Task Name')
			.setDesc('The name of the task')
			.addText(text => text
				.setPlaceholder('Enter task name')
				.setValue(this.titleValue)
				.onChange(value => {
					this.titleValue = value;
				}));

		// Start Date
		new Setting(contentEl)
			.setName('Start Date')
			.setDesc('When the task starts')
			.addText(text => {
				text.inputEl.type = 'date';
				text.setValue(this.formatDateForInput(this.startDateValue));
				text.onChange(value => {
					const parsed = new Date(value);
					if (!isNaN(parsed.getTime())) {
						this.startDateValue = parsed;
					}
				});
			});

		// Duration
		new Setting(contentEl)
			.setName('Duration (days)')
			.setDesc('How many days this task takes')
			.addText(text => text
				.setPlaceholder('1')
				.setValue(String(this.durationValue))
				.onChange(value => {
					const num = parseInt(value, 10);
					if (!isNaN(num) && num > 0) {
						this.durationValue = num;
					}
				}));

		// Milestone
		new Setting(contentEl)
			.setName('Milestone')
			.setDesc('Mark this task as a milestone')
			.addToggle(toggle => toggle
				.setValue(this.isMilestoneValue)
				.onChange(value => {
					this.isMilestoneValue = value;
				}));

		// Status
		new Setting(contentEl)
			.setName('Status')
			.setDesc('Current status of the task')
			.addDropdown(dropdown => dropdown
				.addOption('pending', 'Pending')
				.addOption('in_progress', 'In Progress')
				.addOption('done', 'Done')
				.addOption('cancelled', 'Cancelled')
				.setValue(this.statusValue)
				.onChange(value => {
					this.statusValue = value as TaskStatus;
				}));

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'task-edit-buttons' });

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => {
			this.close();
		});

		const saveBtn = buttonContainer.createEl('button', {
			text: 'Save',
			cls: 'mod-cta'
		});
		saveBtn.addEventListener('click', () => {
			this.onSave({
				title: this.titleValue,
				duration: this.durationValue,
				startDate: this.startDateValue,
				isMilestone: this.isMilestoneValue,
				status: this.statusValue,
			});
			this.close();
		});
	}

	private formatDateForInput(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
