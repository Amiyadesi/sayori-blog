import {
	courses,
	holidays,
	makeupDays,
	periods,
	semester,
	type TimetableCourse,
} from "../data/timetable";

const DAY = 86_400_000;
const campusClock = new Intl.DateTimeFormat("en-GB", {
	timeZone: semester.timeZone,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
});

export const minutes = (time: string) => {
	const [hour, minute] = time.split(":").map(Number);
	return hour * 60 + minute;
};

export function addDays(date: string, count: number): string {
	return new Date(Date.parse(`${date}T00:00:00Z`) + count * DAY)
		.toISOString()
		.slice(0, 10);
}

export function teachingWeek(date: string): number {
	return (
		Math.floor(
			(Date.parse(`${date}T00:00:00Z`) -
				Date.parse(`${semester.firstMonday}T00:00:00Z`)) /
				(7 * DAY),
		) + 1
	);
}

export function weekday(date: string): number {
	return new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
}

export function courseTimes(course: TimetableCourse) {
	return {
		start: periods.find((period) => period.number === course.periods[0])!
			.start,
		end: periods.find((period) => period.number === course.periods[1])!.end,
	};
}

export function daySchedule(date: string) {
	const sourceDate = makeupDays[date] || date;
	const week = teachingWeek(sourceDate);
	const holiday = holidays.find(
		(day) => date >= day.start && date <= day.end,
	);
	return {
		date,
		week,
		sourceDate,
		holiday,
		courses:
			date < semester.firstMonday || date > semester.lastDate || holiday
				? []
				: courses
						.filter(
							(course) =>
								course.day === weekday(sourceDate) &&
								week >= course.weeks[0] &&
								week <= course.weeks[1],
						)
						.sort((a, b) => a.periods[0] - b.periods[0]),
	};
}

export function timetableNow(now: Date) {
	const parts = Object.fromEntries(
		campusClock.formatToParts(now).map((part) => [part.type, part.value]),
	);
	const date = `${parts.year}-${parts.month}-${parts.day}`;
	const time = `${parts.hour}:${parts.minute}`;
	const minute = minutes(time);
	const today = daySchedule(date);
	const current = today.courses.find((course) => {
		const times = courseTimes(course);
		return minute >= minutes(times.start) && minute < minutes(times.end);
	});
	const period =
		current &&
		periods.find(
			(period) =>
				period.number >= current.periods[0] &&
				period.number <= current.periods[1] &&
				minute >= minutes(period.start) &&
				minute < minutes(period.end),
		);
	let next: { date: string; course: TimetableCourse } | undefined;
	for (
		let candidate =
			date < semester.firstMonday ? semester.firstMonday : date;
		candidate <= semester.lastDate;
		candidate = addDays(candidate, 1)
	) {
		const course = daySchedule(candidate).courses.find(
			(course) =>
				candidate > date || minutes(courseTimes(course).start) > minute,
		);
		if (course) {
			next = { date: candidate, course };
			break;
		}
	}
	const previous = today.courses.findLast(
		(course) => minutes(courseTimes(course).end) <= minute,
	);
	const betweenClasses =
		!current &&
		previous &&
		next?.date === date &&
		minute - minutes(courseTimes(previous).end) < 30 &&
		minutes(courseTimes(next.course).start) - minute <= 30;
	return {
		date,
		time,
		week: teachingWeek(date),
		today,
		current,
		period,
		next,
		phase: current
			? period
				? "class"
				: "break"
			: betweenClasses
				? "break"
				: "free",
		outsideTerm: date < semester.firstMonday || date > semester.lastDate,
	};
}
