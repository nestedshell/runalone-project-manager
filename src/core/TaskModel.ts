export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';

export interface Task {
	id: string;
	level: number;
	title: string;
	duration: number;
	startDate: Date;
	endDate: Date;
	dependencies: number[];
	isMilestone: boolean;
	isDone: boolean;
	status: TaskStatus;
	color?: string;
	explicitStartDate?: Date;
	manuallyPositioned?: boolean;
	linkedNote?: string;
	children: Task[];
	parent: Task | null;
	lineNumber: number;
	projectId: string;
	indexInProject: number;
}

export interface Project {
	id: string;
	name: string;
	icon: string;
	linkedNote?: string;
	tasks: Task[];
	flatTasks: Task[];
	startDate: Date;
	endDate: Date;
	lineNumber: number;
}

export const PROJECT_ICONS = [
	'📁', '📂', '🚀', '💼', '🎯', '⭐', '🔥', '💡',
	'🛠️', '📊', '📈', '🎨', '🔧', '⚙️', '📱', '💻',
	'🌐', '🏠', '🏢', '📝', '✅', '🎮', '🎬', '📚',
	'🔬', '🧪', '🎵', '🎸', '🏆', '🎁', '❤️', '🌟'
];

export interface TimelineState {
	projects: Project[];
	globalStartDate: Date;
	globalEndDate: Date;
	zoomLevel: ZoomLevel;
	collapsedTasks: Set<string>;
	collapsedProjects: Set<string>;
	selectedTaskId: string | null;
	selectedProjectId: string | null;
	projectsOnly: boolean;
}

export type ZoomLevel = 'day' | 'week' | 'month';

export type ViewMode = 'gantt' | 'kanban';

export interface ParsedTask {
	level: number;
	title: string;
	duration: number;
	dependencies: number[];
	isMilestone: boolean;
	isDone: boolean;
	status: TaskStatus;
	color?: string;
	explicitStartDate?: Date;
	linkedNote?: string;
	lineNumber: number;
}

export interface ParsedProject {
	name: string;
	icon: string;
	linkedNote?: string;
	tasks: ParsedTask[];
	lineNumber: number;
}

export interface ParseResult {
	globalStartDate: Date;
	projects: ParsedProject[];
}

export interface Conflict {
	taskId: string;
	type: 'overlap' | 'dependency_violation' | 'circular_dependency';
	message: string;
	relatedTaskIds: string[];
}

export interface DragState {
	isDragging: boolean;
	dragType: 'move' | 'resize-start' | 'resize-end' | null;
	taskId: string | null;
	startX: number;
	originalStartDate: Date | null;
	originalDuration: number | null;
}

export interface RenderConfig {
	rowHeight: number;
	headerHeight: number;
	taskBarHeight: number;
	taskBarMargin: number;
	labelWidth: number;
	dayWidth: number;
	weekWidth: number;
	monthWidth: number;
	colors: {
		taskBar: string;
		taskBarDone: string;
		taskBarInProgress: string;
		taskBarCancelled: string;
		taskBarHover: string;
		milestone: string;
		dependency: string;
		conflict: string;
		gridLine: string;
		todayLine: string;
		weekend: string;
	};
}

export const DEFAULT_RENDER_CONFIG: RenderConfig = {
	rowHeight: 40,
	headerHeight: 60,
	taskBarHeight: 28,
	taskBarMargin: 6,
	labelWidth: 250,
	dayWidth: 40,
	weekWidth: 100,
	monthWidth: 120,
	colors: {
		taskBar: 'var(--interactive-accent)',
		taskBarDone: '#4caf50',
		taskBarInProgress: '#2196f3',
		taskBarCancelled: '#9e9e9e',
		taskBarHover: 'var(--interactive-accent-hover)',
		milestone: 'var(--text-accent)',
		dependency: 'var(--text-faint)',
		conflict: 'var(--text-error)',
		gridLine: 'var(--background-modifier-border)',
		todayLine: 'var(--text-error)',
		weekend: 'var(--background-secondary)',
	},
};

export function createEmptyState(): TimelineState {
	return {
		projects: [],
		globalStartDate: new Date(),
		globalEndDate: new Date(),
		zoomLevel: 'day',
		collapsedTasks: new Set(),
		collapsedProjects: new Set(),
		selectedTaskId: null,
		selectedProjectId: null,
		projectsOnly: false,
	};
}

export function generateTaskId(projectId: string, index: number): string {
	return `${projectId}-task-${index}`;
}

export function generateProjectId(index: number): string {
	return `project-${index}`;
}
