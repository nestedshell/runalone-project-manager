/**
 * SVG Icon utilities - Creates SVG elements using DOM API instead of innerHTML
 * Following Obsidian plugin guidelines for security
 */

export interface IconOptions {
	width?: number;
	height?: number;
	strokeWidth?: number;
	className?: string;
}

function createSvgElement(tag: string, attrs: Record<string, string>): SVGElement {
	const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
	for (const [key, value] of Object.entries(attrs)) {
		el.setAttribute(key, value);
	}
	return el;
}

function createBaseSvg(options: IconOptions = {}): SVGSVGElement {
	const { width = 18, height = 18, strokeWidth = 2, className } = options;
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('width', String(width));
	svg.setAttribute('height', String(height));
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('fill', 'none');
	svg.setAttribute('stroke', 'currentColor');
	svg.setAttribute('stroke-width', String(strokeWidth));
	if (className) {
		svg.setAttribute('class', className);
	}
	return svg;
}

// Clock icon for duration
export function createClockIcon(options: IconOptions = {}): SVGSVGElement {
	const svg = createBaseSvg({ ...options, width: options.width ?? 12, height: options.height ?? 12 });
	svg.appendChild(createSvgElement('circle', { cx: '12', cy: '12', r: '10' }));
	svg.appendChild(createSvgElement('path', { d: 'M12 6v6l4 2' }));
	return svg;
}

// Link icon for dependencies
export function createLinkIcon(options: IconOptions = {}): SVGSVGElement {
	const svg = createBaseSvg({ ...options, width: options.width ?? 12, height: options.height ?? 12 });
	svg.appendChild(createSvgElement('path', { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' }));
	svg.appendChild(createSvgElement('path', { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' }));
	return svg;
}

// Timeline/Gantt icon
export function createTimelineIcon(options: IconOptions = {}): SVGSVGElement {
	const svg = createBaseSvg({ ...options, width: options.width ?? 14, height: options.height ?? 14, strokeWidth: 2.5 });
	svg.appendChild(createSvgElement('rect', { x: '3', y: '4', width: '16', height: '4', rx: '1' }));
	svg.appendChild(createSvgElement('rect', { x: '5', y: '10', width: '10', height: '4', rx: '1' }));
	svg.appendChild(createSvgElement('rect', { x: '3', y: '16', width: '13', height: '4', rx: '1' }));
	return svg;
}

// Kanban icon
export function createKanbanIcon(options: IconOptions = {}): SVGSVGElement {
	const svg = createBaseSvg({ ...options, width: options.width ?? 14, height: options.height ?? 14, strokeWidth: 2.5 });
	svg.appendChild(createSvgElement('rect', { x: '3', y: '3', width: '5', height: '16', rx: '1' }));
	svg.appendChild(createSvgElement('rect', { x: '10', y: '3', width: '5', height: '10', rx: '1' }));
	svg.appendChild(createSvgElement('rect', { x: '17', y: '3', width: '5', height: '6', rx: '1' }));
	return svg;
}

// Folder plus icon (add project)
export function createFolderPlusIcon(options: IconOptions = {}): SVGSVGElement {
	const svg = createBaseSvg(options);
	svg.appendChild(createSvgElement('path', { d: 'M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z' }));
	svg.appendChild(createSvgElement('line', { x1: '12', y1: '10', x2: '12', y2: '16' }));
	svg.appendChild(createSvgElement('line', { x1: '9', y1: '13', x2: '15', y2: '13' }));
	return svg;
}

// Plus icon (add task)
export function createPlusIcon(options: IconOptions = {}): SVGSVGElement {
	const svg = createBaseSvg(options);
	svg.appendChild(createSvgElement('line', { x1: '12', y1: '5', x2: '12', y2: '19' }));
	svg.appendChild(createSvgElement('line', { x1: '5', y1: '12', x2: '19', y2: '12' }));
	return svg;
}

// Projects only icon
export function createProjectsOnlyIcon(options: IconOptions = {}): SVGSVGElement {
	const svg = createBaseSvg(options);
	svg.appendChild(createSvgElement('rect', { x: '3', y: '3', width: '18', height: '6', rx: '1' }));
	const rect2 = createSvgElement('rect', { x: '3', y: '12', width: '18', height: '6', rx: '1' });
	rect2.setAttribute('opacity', '0.4');
	svg.appendChild(rect2);
	return svg;
}

// Collapse all icon
export function createCollapseIcon(options: IconOptions = {}): SVGSVGElement {
	const svg = createBaseSvg(options);
	svg.appendChild(createSvgElement('path', { d: 'm7 20 5-5 5 5' }));
	svg.appendChild(createSvgElement('path', { d: 'm7 4 5 5 5-5' }));
	return svg;
}

// Expand all icon
export function createExpandIcon(options: IconOptions = {}): SVGSVGElement {
	const svg = createBaseSvg(options);
	svg.appendChild(createSvgElement('path', { d: 'm7 15 5 5 5-5' }));
	svg.appendChild(createSvgElement('path', { d: 'm7 9 5-5 5 5' }));
	return svg;
}

// Undo icon
export function createUndoIcon(options: IconOptions = {}): SVGSVGElement {
	const svg = createBaseSvg(options);
	svg.appendChild(createSvgElement('path', { d: 'M3 7v6h6' }));
	svg.appendChild(createSvgElement('path', { d: 'M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13' }));
	return svg;
}

// Redo icon
export function createRedoIcon(options: IconOptions = {}): SVGSVGElement {
	const svg = createBaseSvg(options);
	svg.appendChild(createSvgElement('path', { d: 'M21 7v6h-6' }));
	svg.appendChild(createSvgElement('path', { d: 'M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7' }));
	return svg;
}

// Refresh icon
export function createRefreshIcon(options: IconOptions = {}): SVGSVGElement {
	const svg = createBaseSvg(options);
	svg.appendChild(createSvgElement('path', { d: 'M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }));
	svg.appendChild(createSvgElement('path', { d: 'M3 3v5h5' }));
	svg.appendChild(createSvgElement('path', { d: 'M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16' }));
	svg.appendChild(createSvgElement('path', { d: 'M16 21h5v-5' }));
	return svg;
}

// External link icon
export function createExternalLinkIcon(options: IconOptions = {}): SVGSVGElement {
	const svg = createBaseSvg({ ...options, width: options.width ?? 16, height: options.height ?? 16 });
	svg.appendChild(createSvgElement('path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }));
	svg.appendChild(createSvgElement('polyline', { points: '15 3 21 3 21 9' }));
	svg.appendChild(createSvgElement('line', { x1: '10', y1: '14', x2: '21', y2: '3' }));
	return svg;
}

// X/Close icon
export function createXIcon(options: IconOptions = {}): SVGSVGElement {
	const svg = createBaseSvg({ ...options, width: options.width ?? 16, height: options.height ?? 16 });
	svg.appendChild(createSvgElement('line', { x1: '18', y1: '6', x2: '6', y2: '18' }));
	svg.appendChild(createSvgElement('line', { x1: '6', y1: '6', x2: '18', y2: '18' }));
	return svg;
}

// Runalone logo
export function createRunaloneLogo(): SVGSVGElement {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('width', '20');
	svg.setAttribute('height', '20');
	svg.setAttribute('viewBox', '0 0 100 100');
	svg.setAttribute('fill', '#8b5cf6');
	svg.setAttribute('stroke', '#8b5cf6');
	svg.setAttribute('class', 'toolbar-logo-svg');

	svg.appendChild(createSvgElement('circle', { cx: '50', cy: '40', r: '22' }));

	const eye1 = createSvgElement('circle', { cx: '42', cy: '38', r: '3' });
	eye1.setAttribute('fill', '#ffffff');
	svg.appendChild(eye1);

	const eye2 = createSvgElement('circle', { cx: '58', cy: '38', r: '3' });
	eye2.setAttribute('fill', '#ffffff');
	svg.appendChild(eye2);

	const tentacles = [
		'M35 58 C25 65, 25 80, 35 85',
		'M45 60 C40 70, 42 85, 45 90',
		'M50 60 C50 72, 50 85, 50 92',
		'M55 60 C58 70, 58 85, 55 90',
		'M65 58 C75 65, 75 80, 65 85',
	];

	tentacles.forEach((d) => {
		const path = createSvgElement('path', { d });
		path.setAttribute('fill', 'none');
		path.setAttribute('stroke-width', '6');
		path.setAttribute('stroke-linecap', 'round');
		svg.appendChild(path);
	});

	return svg;
}
