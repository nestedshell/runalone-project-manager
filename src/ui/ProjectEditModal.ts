import { App, Modal, Setting, Notice } from 'obsidian';
import { Project, PROJECT_ICONS } from '../core/TaskModel';
import { createExternalLinkIcon, createXIcon } from '../utils/Icons';

export interface ProjectEditResult {
	name: string;
	icon: string;
	linkedNote?: string;
}

export class ProjectEditModal extends Modal {
	private project: Project;
	private onSubmit: (result: ProjectEditResult) => void;
	private onDelete: (() => void) | null;
	private result: ProjectEditResult;

	constructor(
		app: App,
		project: Project,
		onSubmit: (result: ProjectEditResult) => void,
		onDelete?: () => void
	) {
		super(app);
		this.project = project;
		this.onSubmit = onSubmit;
		this.onDelete = onDelete || null;
		this.result = {
			name: project.name,
			icon: project.icon || '📁',
			linkedNote: project.linkedNote,
		};
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('project-edit-modal');

		new Setting(contentEl)
			.setName('Edit project')
			.setHeading();

		new Setting(contentEl)
			.setName('Project name')
			.addText((text) => {
				text
					.setValue(this.result.name)
					.onChange((value) => {
						this.result.name = value;
					});
				text.inputEl.focus();
				text.inputEl.select();
			});

		// Icon selector
		new Setting(contentEl)
			.setName('Project icon')
			.setDesc('Select an icon for your project');

		const iconContainer = contentEl.createDiv({ cls: 'project-icon-selector' });

		PROJECT_ICONS.forEach((icon) => {
			const iconBtn = iconContainer.createEl('span', {
				text: icon,
				cls: 'project-icon-option' + (icon === this.result.icon ? ' is-selected' : '')
			});
			iconBtn.addEventListener('click', () => {
				// Remove selection from all
				iconContainer.querySelectorAll('.project-icon-option').forEach(el => {
					el.removeClass('is-selected');
				});
				// Select this one
				iconBtn.addClass('is-selected');
				this.result.icon = icon;
			});
		});

		// Linked note
		const noteSetting = new Setting(contentEl)
			.setName('Linked note')
			.setDesc('Link to an Obsidian note');

		// Note input with autocomplete
		const noteInputContainer = noteSetting.controlEl.createDiv({ cls: 'note-input-container' });

		const noteInput = noteInputContainer.createEl('input', {
			type: 'text',
			placeholder: 'Search for a note...',
			cls: 'note-search-input',
		});
		noteInput.value = this.result.linkedNote || '';

		const suggestionContainer = noteInputContainer.createDiv({ cls: 'note-suggestions is-hidden' });

		// Get all markdown files
		const allFiles = this.app.vault.getMarkdownFiles();

		noteInput.addEventListener('input', () => {
			const query = noteInput.value.toLowerCase();
			this.result.linkedNote = noteInput.value || undefined;

			if (query.length < 1) {
				suggestionContainer.addClass('is-hidden');
				return;
			}

			const matches = allFiles
				.filter(f => f.basename.toLowerCase().includes(query))
				.slice(0, 5);

			suggestionContainer.empty();

			if (matches.length > 0) {
				suggestionContainer.removeClass('is-hidden');
				for (const file of matches) {
					const item = suggestionContainer.createDiv({ cls: 'note-suggestion-item' });
					item.textContent = file.basename;
					item.addEventListener('click', () => {
						noteInput.value = file.basename;
						this.result.linkedNote = file.basename;
						suggestionContainer.addClass('is-hidden');
						// Update button visibility
						this.updateOpenNoteButton(openBtn, noteInput.value);
					});
				}
			} else {
				suggestionContainer.addClass('is-hidden');
			}
		});

		noteInput.addEventListener('blur', () => {
			// Delay to allow click on suggestion
			setTimeout(() => {
				suggestionContainer.addClass('is-hidden');
			}, 200);
		});

		// Open note button
		const openBtn = noteInputContainer.createEl('button', {
			cls: 'note-open-btn' + (this.result.linkedNote ? '' : ' is-hidden'),
			attr: { title: 'Open linked note' },
		});
		openBtn.appendChild(createExternalLinkIcon());
		openBtn.addEventListener('click', (e) => {
			e.preventDefault();
			this.openLinkedNote();
		});

		// Clear note button
		const clearBtn = noteInputContainer.createEl('button', {
			cls: 'note-clear-btn',
			attr: { title: 'Clear linked note' },
		});
		clearBtn.appendChild(createXIcon());
		clearBtn.addEventListener('click', (e) => {
			e.preventDefault();
			noteInput.value = '';
			this.result.linkedNote = undefined;
			this.updateOpenNoteButton(openBtn, '');
		});

		const buttonContainer = contentEl.createDiv({ cls: 'project-edit-buttons' });

		// Delete button (on the left)
		if (this.onDelete) {
			const deleteBtn = buttonContainer.createEl('button', { text: 'Delete project', cls: 'mod-warning project-delete-btn' });
			deleteBtn.addEventListener('click', () => {
				const confirmModal = new DeleteConfirmModal(
					this.app,
					`Delete project "${this.project.name}" and all its tasks?`,
					() => {
						this.onDelete!();
						this.close();
					}
				);
				confirmModal.open();
			});
		}

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => {
			this.close();
		});

		const saveBtn = buttonContainer.createEl('button', { text: 'Save', cls: 'mod-cta' });
		saveBtn.addEventListener('click', () => {
			this.onSubmit(this.result);
			this.close();
		});

		// Handle Enter key
		contentEl.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				this.onSubmit(this.result);
				this.close();
			}
		});
	}

	private openLinkedNote(): void {
		if (!this.result.linkedNote) return;

		const file = this.app.vault.getMarkdownFiles().find(
			f => f.basename === this.result.linkedNote
		);

		if (file) {
			// Open in a new leaf (read mode)
			void this.app.workspace.openLinkText(file.path, '', true);
			this.close();
		} else {
			new Notice(`Note "${this.result.linkedNote}" not found`);
		}
	}

	private updateOpenNoteButton(btn: HTMLButtonElement, value: string): void {
		if (value) {
			btn.removeClass('is-hidden');
		} else {
			btn.addClass('is-hidden');
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

// Confirmation modal for delete action
class DeleteConfirmModal extends Modal {
	private message: string;
	private onConfirm: () => void;

	constructor(app: App, message: string, onConfirm: () => void) {
		super(app);
		this.message = message;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('confirm-modal');

		contentEl.createEl('p', { text: this.message });

		const buttonContainer = contentEl.createDiv({ cls: 'confirm-modal-buttons' });

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => {
			this.close();
		});

		const confirmBtn = buttonContainer.createEl('button', {
			text: 'Delete',
			cls: 'mod-warning'
		});
		confirmBtn.addEventListener('click', () => {
			this.onConfirm();
			this.close();
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
