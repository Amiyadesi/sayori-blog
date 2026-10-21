import { periods } from "../data/timetable";

export interface CalendarEvent {
	title: string;
	location: string;
	start: string;
	end: string;
	course: boolean;
}

export interface CalendarSnapshot {
	rangeStart: string;
	rangeEnd: string;
	syncedAt: string;
	events: CalendarEvent[];
}

export function calendarPoint(value: string) {
	if (value.length === 10) return { date: value, time: "00:00" };
	const local = new Date(Date.parse(value) + 8 * 3_600_000).toISOString();
	return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

export const calendarTimestamp = (value: string) =>
	Date.parse(value.length === 10 ? `${value}T00:00:00+08:00` : value);

export function parseCalendarSnapshot(value: unknown): CalendarSnapshot {
	const data = value as CalendarSnapshot;
	const validDate = (date: unknown): date is string =>
		typeof date === "string" &&
		/^\d{4}-\d{2}-\d{2}$/.test(date) &&
		Number.isFinite(Date.parse(date)) &&
		new Date(date).toISOString().slice(0, 10) === date;
	const validTime = (time: unknown): time is string =>
		typeof time === "string" &&
		(validDate(time) ||
			(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(time) &&
				Number.isFinite(Date.parse(time)) &&
				new Date(time).toISOString() === time));
	if (
		!data ||
		!validDate(data.rangeStart) ||
		!validDate(data.rangeEnd) ||
		data.rangeEnd <= data.rangeStart ||
		typeof data.syncedAt !== "string" ||
		!Number.isFinite(Date.parse(data.syncedAt)) ||
		!Array.isArray(data.events) ||
		data.events.length > 50_000 ||
		!data.events.every(
			(event) =>
				event &&
				typeof event.title === "string" &&
				!!event.title.trim() &&
				event.title.length <= 1000 &&
				typeof event.location === "string" &&
				event.location.length <= 2000 &&
				typeof event.course === "boolean" &&
				validTime(event.start) &&
				validTime(event.end) &&
				event.start.length === event.end.length &&
				event.start < event.end,
		)
	) {
		throw new Error("Invalid public calendar snapshot");
	}
	return data;
}

export function calendarDay(events: CalendarEvent[], date: string) {
	const start = calendarTimestamp(date);
	return events
		.filter(
			(event) =>
				calendarTimestamp(event.start) < start + 86_400_000 &&
				calendarTimestamp(event.end) > start,
		)
		.sort(
			(a, b) => calendarTimestamp(a.start) - calendarTimestamp(b.start),
		);
}

export function calendarNow(events: CalendarEvent[], now: Date) {
	const timestamp = now.getTime();
	const ordered = [...events].sort(
		(a, b) => calendarTimestamp(a.start) - calendarTimestamp(b.start),
	);
	const active = ordered.filter(
		(event) =>
			calendarTimestamp(event.start) <= timestamp &&
			timestamp < calendarTimestamp(event.end),
	);
	const current =
		active.find((event) => event.start.length !== 10) || active[0];
	const next = ordered.find(
		(event) => calendarTimestamp(event.start) > timestamp,
	);
	const time = calendarPoint(now.toISOString()).time;
	const classPeriods =
		current?.course &&
		current.start.length !== 10 &&
		periods.some(
			(period) => period.start === calendarPoint(current.start).time,
		) &&
		periods.some(
			(period) => period.end === calendarPoint(current.end).time,
		);
	const period = classPeriods
		? periods.find((period) => time >= period.start && time < period.end)
		: undefined;
	const previous = ordered.findLast(
		(event) => event.course && calendarTimestamp(event.end) <= timestamp,
	);
	const betweenClasses =
		!current &&
		previous &&
		next?.course &&
		calendarPoint(previous.end).date ===
			calendarPoint(now.toISOString()).date &&
		timestamp - calendarTimestamp(previous.end) < 30 * 60_000 &&
		calendarTimestamp(next.start) - timestamp <= 30 * 60_000;
	return {
		current,
		next,
		period,
		phase: current
			? classPeriods && !period
				? "break"
				: "class"
			: betweenClasses
				? "break"
				: "free",
	};
}
