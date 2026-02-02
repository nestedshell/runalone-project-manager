import { Task, RenderConfig } from '../core/TaskModel';

export interface TaskBarProps {
	task: Task;
	x: number;
	y: number;
	width: number;
	height: number;
	isSelected: boolean;
	config: RenderConfig;
}

export function createTaskBarElement(props: TaskBarProps): SVGGElement {
	const { task, x, y, width, height, isSelected, config } = props;

	const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
	group.setAttribute('class', 'task-bar-group');
	group.setAttribute('data-task-id', task.id);

	const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
	bar.setAttribute('x', String(x));
	bar.setAttribute('y', String(y));
	bar.setAttribute('width', String(width));
	bar.setAttribute('height', String(height));
	bar.setAttribute('rx', '4');
	bar.setAttribute('ry', '4');
	bar.setAttribute('fill', task.color || (task.isDone ? config.colors.taskBarDone : config.colors.taskBar));
	bar.setAttribute('class', 'task-bar');
	bar.setAttribute('cursor', 'grab');

	if (isSelected) {
		bar.setAttribute('stroke', 'var(--text-accent)');
		bar.setAttribute('stroke-width', '2');
	}

	group.appendChild(bar);

	if (task.isDone) {
		const progressWidth = width;
		const progress = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		progress.setAttribute('x', String(x));
		progress.setAttribute('y', String(y));
		progress.setAttribute('width', String(progressWidth));
		progress.setAttribute('height', String(height));
		progress.setAttribute('rx', '4');
		progress.setAttribute('ry', '4');
		progress.setAttribute('fill', 'var(--text-muted)');
		progress.setAttribute('opacity', '0.3');
		group.appendChild(progress);
	}

	const leftHandle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
	leftHandle.setAttribute('x', String(x));
	leftHandle.setAttribute('y', String(y));
	leftHandle.setAttribute('width', '8');
	leftHandle.setAttribute('height', String(height));
	leftHandle.setAttribute('fill', 'transparent');
	leftHandle.setAttribute('cursor', 'ew-resize');
	leftHandle.setAttribute('class', 'resize-handle resize-handle-left');
	group.appendChild(leftHandle);

	const rightHandle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
	rightHandle.setAttribute('x', String(x + width - 8));
	rightHandle.setAttribute('y', String(y));
	rightHandle.setAttribute('width', '8');
	rightHandle.setAttribute('height', String(height));
	rightHandle.setAttribute('fill', 'transparent');
	rightHandle.setAttribute('cursor', 'ew-resize');
	rightHandle.setAttribute('class', 'resize-handle resize-handle-right');
	group.appendChild(rightHandle);

	if (width > 60) {
		const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		label.setAttribute('x', String(x + 8));
		label.setAttribute('y', String(y + height / 2 + 4));
		label.setAttribute('fill', 'var(--text-on-accent)');
		label.setAttribute('font-size', '11');
		label.setAttribute('pointer-events', 'none');
		const maxChars = Math.floor((width - 16) / 7);
		const displayTitle = task.title.length > maxChars
			? task.title.substring(0, maxChars - 2) + '..'
			: task.title;
		label.textContent = displayTitle;
		group.appendChild(label);
	}

	return group;
}

export function createMilestoneElement(
	task: Task,
	x: number,
	y: number,
	isSelected: boolean,
	config: RenderConfig
): SVGPolygonElement {
	const size = 10;
	const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
	const points = [
		`${x},${y - size}`,
		`${x + size},${y}`,
		`${x},${y + size}`,
		`${x - size},${y}`,
	].join(' ');

	diamond.setAttribute('points', points);
	diamond.setAttribute('fill', task.color || config.colors.milestone);
	diamond.setAttribute('class', 'milestone');
	diamond.setAttribute('data-task-id', task.id);
	diamond.setAttribute('cursor', 'pointer');

	if (isSelected) {
		diamond.setAttribute('stroke', 'var(--text-accent)');
		diamond.setAttribute('stroke-width', '2');
	}

	return diamond;
}

export function updateTaskBarPosition(
	element: SVGGElement,
	x: number,
	width: number
): void {
	const bar = element.querySelector('.task-bar');
	if (bar) {
		bar.setAttribute('x', String(x));
		bar.setAttribute('width', String(width));
	}

	const leftHandle = element.querySelector('.resize-handle-left');
	if (leftHandle) {
		leftHandle.setAttribute('x', String(x));
	}

	const rightHandle = element.querySelector('.resize-handle-right');
	if (rightHandle) {
		rightHandle.setAttribute('x', String(x + width - 8));
	}

	const label = element.querySelector('text');
	if (label) {
		label.setAttribute('x', String(x + 8));
	}
}
