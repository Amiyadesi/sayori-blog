import {
	courseProject,
	courses,
	semester,
	type TimetableCourse,
} from "../data/timetable";
import {
	addDays,
	courseTimes,
	daySchedule,
	timetableNow,
	teachingWeek,
	weekday,
} from "../utils/timetable";
import {
	calendarDay,
	calendarNow,
	calendarPoint,
	calendarTimestamp,
	parseCalendarSnapshot,
	type CalendarEvent,
	type CalendarSnapshot,
} from "../utils/timetable-calendar";

let dispose: (() => void) | undefined;

function setupTimetable() {
	dispose?.();
	dispose = undefined;
	const root = document.querySelector<HTMLElement>("#class-timetable");
	if (!root) return;
	const locale = root.dataset.locale!;
	const copy: Record<string, string> = JSON.parse(root.dataset.copy!);
	const holidayNames = new Map<string, string>(
		JSON.parse(root.dataset.holidays!),
	);
	const dateFormat = new Intl.DateTimeFormat(root.dataset.locale, {
		month: "short",
		day: "numeric",
		weekday: "short",
		timeZone: "UTC",
	});
	const formatDate = (date: string) =>
		dateFormat.format(new Date(`${date}T00:00:00Z`));
	const node = <T extends HTMLElement = HTMLElement>(selector: string) =>
		root.querySelector<T>(selector)!;
	const setText = (selector: string, text: string) => {
		const element = node(selector);
		if (element.textContent !== text) element.textContent = text;
	};
	const templates = new Map(
		Array.from(
			root.querySelectorAll<HTMLElement>("[data-course-id]"),
			(row) => [
				row.dataset.courseId!,
				row.cloneNode(true) as HTMLElement,
			],
		),
	);
	const courseText = (course: TimetableCourse, selector: string) =>
		templates.get(course.id)!.querySelector(selector)!.textContent!;
	const courseTitle = (course: TimetableCourse) =>
		courseText(course, ".course-title");
	const courseRoom = (course: TimetableCourse) =>
		courseText(course, ".course-room");
	const courseRange = (course: TimetableCourse) =>
		`${courseTimes(course).start}–${courseTimes(course).end}`;
	const controller = new AbortController();
	const { signal } = controller;
	let state = timetableNow(new Date());
	let selectedWeek = Math.max(1, Math.min(semester.weeks, state.week));
	let selectedDay = weekday(state.date);
	let wholeWeek = false;
	let followToday = true;
	let calendar: CalendarSnapshot | undefined;
	let minWeek = 1;
	let maxWeek = semester.weeks;
	let syncing = false;
	let syncFailed = false;
	let lastAttempt = 0;
	const select = node<HTMLSelectElement>("[data-week]");
	const syncButton = node<HTMLButtonElement>("[data-calendar-sync]");
	const syncFormat = new Intl.DateTimeFormat(root.dataset.locale, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
		timeZone: semester.timeZone,
	});
	const projectTitle = node("[data-project] strong").textContent!;
	const dayButtons = Array.from(
		root.querySelectorAll<HTMLButtonElement>("[data-day-button]"),
	);
	const panels = Array.from(root.querySelectorAll<HTMLElement>("[data-day]"));
	for (const selector of [
		"[data-now]",
		"[data-clock-wrap]",
		"[data-controls]",
		"[data-days]",
		"[data-calendar-sync]",
	])
		node(selector).hidden = false;

	const eventTitle = (event: CalendarEvent) =>
		root.dataset.locale === "en" && event.course
			? courses.find(
					(course) =>
						course.title.replace(/\s/gu, "") ===
						event.title.replace(/\s/gu, ""),
				)?.titleEn || event.title
			: event.title;
	const eventRange = (event: CalendarEvent) => {
		if (event.start.length === 10) return copy.allDay;
		const start = calendarPoint(event.start);
		const end = calendarPoint(event.end);
		return `${start.time}–${start.date === end.date ? "" : `${formatDate(end.date)} `}${end.time}`;
	};
	function updateSyncStatus() {
		const delayed =
			calendar &&
			Date.now() - Date.parse(calendar.syncedAt) > 15 * 60_000;
		setText(
			"[data-calendar-status]",
			syncing
				? calendar
					? copy.syncRefreshing
					: copy.syncLoading
				: calendar
					? `${syncFailed ? copy.syncFailed : delayed ? copy.syncDelayed : copy.syncReady} · ${syncFormat.format(new Date(calendar.syncedAt))}`
					: copy.syncLocal,
		);
		syncButton.disabled = syncing;
		syncButton.textContent =
			syncFailed || delayed ? copy.retry : copy.refresh;
	}
	function calendarRow(
		event: CalendarEvent,
		date: string,
		shortBreak: boolean,
	) {
		const row = templates
			.values()
			.next()
			.value!.cloneNode(true) as HTMLElement;
		row.removeAttribute("data-course-id");
		row.querySelector(".course-title")!.textContent = eventTitle(event);
		row.querySelector(".course-room")!.textContent = event.location;
		row.querySelector<HTMLElement>("[data-course-periods]")!.hidden = true;
		row.querySelector<HTMLElement>(".timetable-course-weeks")!.hidden =
			true;
		const times = row.querySelectorAll<HTMLElement>(
			".timetable-course-time span",
		);
		const start = calendarPoint(event.start);
		const end = calendarPoint(event.end);
		times[0].textContent =
			event.start.length === 10
				? copy.allDay
				: start.date < date
					? "00:00"
					: start.time;
		times[1].textContent =
			event.start.length === 10
				? ""
				: end.date > date
					? "24:00"
					: end.time;
		const current =
			date === state.date &&
			calendarTimestamp(event.start) <= Date.now() &&
			Date.now() < calendarTimestamp(event.end);
		row.toggleAttribute("data-current", current);
		const badge = row.querySelector<HTMLElement>("[data-course-state]")!;
		badge.hidden = !current;
		badge.textContent = shortBreak
			? copy.break
			: event.course
				? copy.current
				: copy.ongoing;
		return row;
	}

	async function syncCalendar() {
		if (syncing) return;
		syncing = true;
		lastAttempt = Date.now();
		updateSyncStatus();
		try {
			const response = await fetch(
				`/api/timetable?locale=${encodeURIComponent(locale)}`,
				{
					cache: "no-store",
					signal: AbortSignal.any([
						signal,
						AbortSignal.timeout(15_000),
					]),
				},
			);
			if (!response.ok)
				throw new Error(`Calendar unavailable (${response.status})`);
			const nextCalendar = parseCalendarSnapshot(await response.json());
			if (signal.aborted) return;
			calendar = nextCalendar;
			minWeek = teachingWeek(calendar.rangeStart);
			maxWeek = teachingWeek(addDays(calendar.rangeEnd, -1));
			select.replaceChildren(
				...Array.from({ length: maxWeek - minWeek + 1 }, (_, index) => {
					const week = minWeek + index;
					const monday = addDays(
						semester.firstMonday,
						(week - 1) * 7,
					);
					const label = `${formatDate(monday)}–${formatDate(addDays(monday, 6))}`;
					return new Option(
						week >= 1 && week <= semester.weeks
							? `${copy.week.replace("{n}", String(week))} · ${label}`
							: label,
						String(week),
					);
				}),
			);
			selectedWeek = Math.max(minWeek, Math.min(maxWeek, selectedWeek));
			syncFailed = false;
		} catch (error) {
			if (signal.aborted) return;
			syncFailed = true;
			console.warn("Timetable sync failed", error);
		} finally {
			syncing = false;
			if (!signal.aborted) refresh();
		}
	}

	function renderAgenda() {
		const live = calendar
			? calendarNow(calendar.events, new Date())
			: undefined;
		select.value = String(selectedWeek);
		node<HTMLButtonElement>("[data-previous]").disabled =
			selectedWeek === minWeek;
		node<HTMLButtonElement>("[data-following]").disabled =
			selectedWeek === maxWeek;
		node<HTMLButtonElement>("[data-today]").hidden =
			!calendar && state.outsideTerm;
		node("[data-all-week]").setAttribute("aria-pressed", String(wholeWeek));
		node("[data-agenda]").toggleAttribute("data-whole-week", wholeWeek);
		const monday = addDays(semester.firstMonday, (selectedWeek - 1) * 7);
		for (const [index, button] of dayButtons.entries()) {
			const date = addDays(monday, index);
			button.querySelector("[data-day-date]")!.textContent = date
				.slice(5)
				.replace("-", "/");
			button.setAttribute(
				"aria-pressed",
				String(!wholeWeek && selectedDay === index + 1),
			);
			if (date === state.date)
				button.setAttribute("aria-current", "date");
			else button.removeAttribute("aria-current");
		}
		for (const panel of panels) {
			const day = Number(panel.dataset.day);
			const date = addDays(monday, day - 1);
			const schedule = daySchedule(date);
			panel.hidden = !wholeWeek && day !== selectedDay;
			const panelDate =
				panel.querySelector<HTMLTimeElement>("[data-panel-date]")!;
			panelDate.textContent = date.slice(5).replace("-", "/");
			panelDate.dateTime = date;
			const note = panel.querySelector<HTMLElement>("[data-day-note]")!;
			if (calendar) {
				const events = calendarDay(calendar.events, date);
				note.hidden = true;
				panel
					.querySelector("ol")!
					.replaceChildren(
						...events.map((event) =>
							calendarRow(
								event,
								date,
								live?.current === event &&
									live.phase === "break",
							),
						),
					);
				panel.querySelector<HTMLElement>("[data-empty]")!.hidden =
					events.length > 0;
				continue;
			}
			note.hidden = !schedule.holiday && schedule.sourceDate === date;
			note.textContent = schedule.holiday
				? `${holidayNames.get(schedule.holiday.start)} · ${copy.holiday}`
				: `${copy.makeup} ${schedule.sourceDate}`;
			panel.querySelector("ol")!.replaceChildren(
				...schedule.courses.map((course) => {
					const row = templates
						.get(course.id)!
						.cloneNode(true) as HTMLElement;
					const current =
						date === state.date && state.current?.id === course.id;
					row.toggleAttribute("data-current", current);
					const badge = row.querySelector<HTMLElement>(
						"[data-course-state]",
					)!;
					badge.hidden = !current;
					badge.textContent =
						state.phase === "break" ? copy.break : copy.current;
					return row;
				}),
			);
			panel.querySelector<HTMLElement>("[data-empty]")!.hidden =
				schedule.courses.length > 0;
		}
		node("[data-project]").hidden =
			!!calendar || selectedWeek !== courseProject.week;
	}

	function refresh() {
		state = timetableNow(new Date());
		if (followToday) {
			selectedWeek = Math.max(minWeek, Math.min(maxWeek, state.week));
			selectedDay = weekday(state.date);
		}
		const clock = node<HTMLTimeElement>("[data-clock]");
		clock.dateTime = `${state.date}T${state.time}:00+08:00`;
		clock.textContent = `${state.date} ${state.time}`;
		updateSyncStatus();
		if (calendar) {
			const live = calendarNow(calendar.events, new Date());
			const detail = (event: CalendarEvent) =>
				[event.location, eventRange(event)].filter(Boolean).join(" · ");
			node("[data-now]").dataset.phase = live.phase;
			setText(
				"[data-current-label]",
				live.phase === "break"
					? copy.break
					: live.current
						? live.current.course
							? copy.current
							: copy.ongoing
						: copy.free,
			);
			setText(
				"[data-current-name]",
				live.current ? eventTitle(live.current) : copy.noEvent,
			);
			setText(
				"[data-current-detail]",
				live.current
					? `${detail(live.current)}${live.period ? ` · ${copy.period.replace("{n}", String(live.period.number))}` : ""}`
					: formatDate(state.date),
			);
			setText(
				"[data-next-name]",
				live.next ? eventTitle(live.next) : copy.noNextEvent,
			);
			setText(
				"[data-next-detail]",
				live.next
					? `${formatDate(calendarPoint(live.next.start).date)} · ${detail(live.next)}`
					: "",
			);
			renderAgenda();
			return;
		}
		node("[data-now]").dataset.phase = state.phase;
		setText(
			"[data-current-label]",
			state.phase === "class"
				? copy.current
				: state.phase === "break"
					? copy.break
					: copy.free,
		);
		setText(
			"[data-current-name]",
			state.current
				? courseTitle(state.current)
				: state.outsideTerm
					? state.date < semester.firstMonday
						? copy.beforeTerm
						: copy.afterTerm
					: state.week === courseProject.week
						? projectTitle
						: state.phase === "break"
							? copy.break
							: copy.noClass,
		);
		setText(
			"[data-current-detail]",
			state.current
				? `${courseRoom(state.current)} · ${courseRange(state.current)}${state.period ? ` · ${copy.period.replace("{n}", String(state.period.number))}` : ""}`
				: state.week === courseProject.week
					? copy.unscheduled
					: state.today.holiday
						? `${holidayNames.get(state.today.holiday.start)} · ${copy.holiday}`
						: state.outsideTerm
							? `${semester.firstMonday} – ${semester.lastDate}`
							: `${formatDate(state.date)} · ${copy.week.replace("{n}", String(state.week))}`,
		);
		setText(
			"[data-next-name]",
			state.next ? courseTitle(state.next.course) : copy.noNext,
		);
		setText(
			"[data-next-detail]",
			state.next
				? `${formatDate(state.next.date)} ${courseTimes(state.next.course).start} · ${courseRoom(state.next.course)}`
				: "",
		);
		renderAgenda();
	}

	root.addEventListener(
		"click",
		(event) => {
			if (!(event.target instanceof Element)) return;
			const button = event.target.closest<HTMLButtonElement>("button");
			if (!button) return;
			if (button.hasAttribute("data-calendar-sync")) {
				void syncCalendar();
				return;
			} else if (button.hasAttribute("data-previous")) {
				selectedWeek--;
				followToday = false;
			} else if (button.hasAttribute("data-following")) {
				selectedWeek++;
				followToday = false;
			} else if (button.hasAttribute("data-today")) followToday = true;
			else if (button.hasAttribute("data-day-button")) {
				selectedDay = Number(button.dataset.dayButton);
				wholeWeek = false;
				followToday = false;
			} else if (button.hasAttribute("data-all-week")) {
				wholeWeek = !wholeWeek;
				followToday = false;
			} else return;
			refresh();
		},
		{ signal },
	);
	select.addEventListener(
		"change",
		() => {
			selectedWeek = Number(select.value);
			followToday = false;
			refresh();
		},
		{ signal },
	);
	document.addEventListener(
		"visibilitychange",
		() => {
			if (!document.hidden) {
				refresh();
				if (Date.now() - lastAttempt >= 300_000) void syncCalendar();
			}
		},
		{ signal },
	);
	refresh();
	void syncCalendar();
	const syncTimer = window.setInterval(() => {
		if (!document.hidden) void syncCalendar();
	}, 300_000);
	const timer = window.setInterval(() => {
		if (!document.hidden) refresh();
	}, 30_000);
	dispose = () => {
		controller.abort();
		window.clearInterval(timer);
		window.clearInterval(syncTimer);
	};
}

document.addEventListener("astro:page-load", setupTimetable);
document.addEventListener("astro:before-swap", () => dispose?.());
