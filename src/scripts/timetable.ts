import {
	courseProject,
	semester,
	type TimetableCourse,
} from "../data/timetable";
import {
	addDays,
	courseTimes,
	daySchedule,
	timetableNow,
	weekday,
} from "../utils/timetable";

let dispose: (() => void) | undefined;

function setupTimetable() {
	dispose?.();
	dispose = undefined;
	const root = document.querySelector<HTMLElement>("#class-timetable");
	if (!root) return;
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
	const select = node<HTMLSelectElement>("[data-week]");
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
	])
		node(selector).hidden = false;

	function renderAgenda() {
		select.value = String(selectedWeek);
		node<HTMLButtonElement>("[data-previous]").disabled =
			selectedWeek === 1;
		node<HTMLButtonElement>("[data-following]").disabled =
			selectedWeek === semester.weeks;
		node<HTMLButtonElement>("[data-today]").hidden = state.outsideTerm;
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
		node("[data-project]").hidden = selectedWeek !== courseProject.week;
	}

	function refresh() {
		state = timetableNow(new Date());
		if (followToday) {
			selectedWeek = Math.max(1, Math.min(semester.weeks, state.week));
			selectedDay = weekday(state.date);
		}
		const clock = node<HTMLTimeElement>("[data-clock]");
		clock.dateTime = `${state.date}T${state.time}:00+08:00`;
		clock.textContent = `${state.date} ${state.time}`;
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
			if (button.hasAttribute("data-previous")) {
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
			if (!document.hidden) refresh();
		},
		{ signal },
	);
	refresh();
	const timer = window.setInterval(() => {
		if (!document.hidden) refresh();
	}, 30_000);
	dispose = () => {
		controller.abort();
		window.clearInterval(timer);
	};
}

document.addEventListener("astro:page-load", setupTimetable);
document.addEventListener("astro:before-swap", () => dispose?.());
