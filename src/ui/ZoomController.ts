import { ZoomLevel } from '../core/TaskModel';

export interface ZoomControllerCallbacks {
	onZoomChange: (level: ZoomLevel) => void;
}

export class ZoomController {
	private currentLevel: ZoomLevel = 'day';
	private callbacks: ZoomControllerCallbacks | null = null;
	private container: HTMLElement | null = null;

	setCallbacks(callbacks: ZoomControllerCallbacks): void {
		this.callbacks = callbacks;
	}

	render(container: HTMLElement, currentLevel: ZoomLevel): void {
		this.container = container;
		this.currentLevel = currentLevel;

		container.empty();
		container.addClass('zoom-controller');

		const levels: { level: ZoomLevel; label: string; shortLabel: string }[] = [
			{ level: 'day', label: 'Days', shortLabel: 'D' },
			{ level: 'week', label: 'Weeks', shortLabel: 'W' },
			{ level: 'month', label: 'Months', shortLabel: 'M' },
		];

		const buttonGroup = container.createDiv({ cls: 'zoom-button-group' });

		levels.forEach(({ level, label, shortLabel }) => {
			const button = buttonGroup.createEl('button', {
				cls: `zoom-button ${level === currentLevel ? 'is-active' : ''}`,
				text: shortLabel,
				attr: {
					'aria-label': label,
					'title': label,
				},
			});

			button.addEventListener('click', () => {
				this.setZoom(level);
			});
		});
	}

	setZoom(level: ZoomLevel): void {
		if (level === this.currentLevel) return;

		this.currentLevel = level;

		if (this.container) {
			const buttons = this.container.querySelectorAll('.zoom-button');
			buttons.forEach((btn) => {
				btn.removeClass('is-active');
				if (btn.textContent === this.getLevelShortLabel(level)) {
					btn.addClass('is-active');
				}
			});
		}

		if (this.callbacks) {
			this.callbacks.onZoomChange(level);
		}
	}

	private getLevelShortLabel(level: ZoomLevel): string {
		switch (level) {
			case 'day': return 'D';
			case 'week': return 'W';
			case 'month': return 'M';
		}
	}

	getCurrentLevel(): ZoomLevel {
		return this.currentLevel;
	}

	zoomIn(): void {
		switch (this.currentLevel) {
			case 'month':
				this.setZoom('week');
				break;
			case 'week':
				this.setZoom('day');
				break;
		}
	}

	zoomOut(): void {
		switch (this.currentLevel) {
			case 'day':
				this.setZoom('week');
				break;
			case 'week':
				this.setZoom('month');
				break;
		}
	}

	destroy(): void {
		this.container = null;
		this.callbacks = null;
	}
}

export const zoomController = new ZoomController();
