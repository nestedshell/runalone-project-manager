export function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

export function subtractDays(date: Date, days: number): Date {
	return addDays(date, -days);
}

export function daysBetween(start: Date, end: Date): number {
	const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
	const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
	return Math.ceil((endTime - startTime) / (1000 * 60 * 60 * 24));
}

export function isSameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

export function isWeekend(date: Date): boolean {
	const day = date.getDay();
	return day === 0 || day === 6;
}

export function startOfWeek(date: Date): Date {
	const result = new Date(date);
	const day = result.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	result.setDate(result.getDate() + diff);
	return result;
}

export function startOfMonth(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function formatDate(date: Date, format: 'short' | 'medium' | 'long' = 'medium'): string {
	const options: Intl.DateTimeFormatOptions = {};

	switch (format) {
		case 'short':
			options.day = 'numeric';
			break;
		case 'medium':
			options.month = 'short';
			options.day = 'numeric';
			break;
		case 'long':
			options.year = 'numeric';
			options.month = 'short';
			options.day = 'numeric';
			break;
	}

	return date.toLocaleDateString('en-US', options);
}

export function formatDateISO(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function parseDate(str: string): Date | null {
	const parts = str.split('-');
	if (parts.length !== 3) return null;

	const year = parseInt(parts[0], 10);
	const month = parseInt(parts[1], 10) - 1;
	const day = parseInt(parts[2], 10);

	if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

	return new Date(year, month, day);
}

export function getWeekNumber(date: Date): number {
	const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
	const dayNum = d.getUTCDay() || 7;
	d.setUTCDate(d.getUTCDate() + 4 - dayNum);
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function getMonthName(date: Date, format: 'short' | 'long' = 'short'): string {
	return date.toLocaleDateString('en-US', { month: format });
}

export function cloneDate(date: Date): Date {
	return new Date(date.getTime());
}

export function minDate(...dates: Date[]): Date {
	return new Date(Math.min(...dates.map(d => d.getTime())));
}

export function maxDate(...dates: Date[]): Date {
	return new Date(Math.max(...dates.map(d => d.getTime())));
}

export function isDateInRange(date: Date, start: Date, end: Date): boolean {
	const time = date.getTime();
	return time >= start.getTime() && time <= end.getTime();
}

export function generateDateRange(start: Date, end: Date): Date[] {
	const dates: Date[] = [];
	let current = cloneDate(start);

	while (current <= end) {
		dates.push(cloneDate(current));
		current = addDays(current, 1);
	}

	return dates;
}

export function generateWeekRange(start: Date, end: Date): Date[] {
	const weeks: Date[] = [];
	let current = startOfWeek(start);

	while (current <= end) {
		weeks.push(cloneDate(current));
		current = addDays(current, 7);
	}

	return weeks;
}

export function generateMonthRange(start: Date, end: Date): Date[] {
	const months: Date[] = [];
	let current = startOfMonth(start);

	while (current <= end) {
		months.push(cloneDate(current));
		current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
	}

	return months;
}
