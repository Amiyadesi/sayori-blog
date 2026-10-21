import assert from "node:assert/strict";
import { test } from "node:test";
import { courses, semester } from "../data/timetable";
import {
	addDays,
	courseTimes,
	daySchedule,
	teachingWeek,
	timetableNow,
} from "./timetable";

test("campus clock uses Beijing time and the official semester week", () => {
	const state = timetableNow(new Date("2026-10-21T01:00:00Z"));
	assert.equal(state.date, "2026-10-21");
	assert.equal(state.time, "09:00");
	assert.equal(state.week, 7);
	assert.equal(state.current?.id, "computer");
	assert.equal(state.period?.number, 1);
	assert.equal(state.phase, "class");
	assert.equal(teachingWeek("2026-09-06"), 0);
	assert.equal(teachingWeek("2026-09-07"), 1);
	assert.equal(teachingWeek("2026-09-14"), 2);
});

test("class starts, short breaks and exact end times are distinct", () => {
	const at = (time: string) =>
		timetableNow(new Date(`2026-10-19T${time}:00+08:00`));
	assert.equal(at("08:39").current, undefined);
	assert.equal(at("08:40").current?.id, "english");
	assert.equal(at("09:25").phase, "break");
	assert.equal(at("09:25").current?.id, "english");
	assert.equal(at("09:30").period?.number, 2);
	assert.equal(at("10:15").current, undefined);
	assert.equal(at("10:15").phase, "break");
	assert.equal(at("10:15").next?.course.id, "data-mon");
	assert.equal(at("12:30").phase, "free");
	assert.equal(at("20:55").current, undefined);
	assert.equal(at("20:55").next?.date, "2026-10-20");
});

test("week ranges include their endpoints and Wednesday courses do not overlap", () => {
	assert.ok(
		daySchedule("2026-09-09").courses.some(
			(course) => course.id === "career",
		),
	);
	assert.ok(
		daySchedule("2026-09-30").courses.some(
			(course) => course.id === "career",
		),
	);
	assert.ok(
		!daySchedule("2026-10-21").courses.some((course) =>
			["career", "policy"].includes(course.id),
		),
	);
	assert.ok(
		daySchedule("2026-12-02").courses.some(
			(course) => course.id === "policy",
		),
	);
	assert.ok(
		daySchedule("2026-09-15").courses.some(
			(course) => course.id === "physics-lab",
		),
	);
	assert.ok(
		daySchedule("2026-11-24").courses.some(
			(course) => course.id === "physics-lab",
		),
	);
	assert.ok(
		!daySchedule("2026-12-01").courses.some(
			(course) => course.id === "physics-lab",
		),
	);
});

test("holidays stop regular classes and makeup days use the source teaching week", () => {
	assert.equal(daySchedule("2026-09-25").courses.length, 0);
	assert.equal(daySchedule("2026-10-06").courses.length, 0);
	assert.equal(daySchedule("2027-01-01").courses.length, 0);
	assert.deepEqual(
		daySchedule("2026-09-20").courses.map((course) => course.id),
		["data-tue", "probability", "physics-lab", "pe"],
	);
	assert.deepEqual(
		daySchedule("2026-10-10").courses.map((course) => course.id),
		["computer", "product"],
	);
	assert.equal(daySchedule("2026-10-10").week, 5);
	assert.equal(daySchedule("2026-10-10").sourceDate, "2026-10-07");
});

test("weekends, unscheduled project week and term boundaries never invent a class", () => {
	assert.equal(daySchedule("2026-10-24").courses.length, 0);
	assert.equal(
		timetableNow(new Date("2026-10-24T12:00:00+08:00")).next?.date,
		"2026-10-26",
	);
	assert.equal(daySchedule("2026-12-28").courses.length, 0);
	const before = timetableNow(new Date("2026-09-01T12:00:00+08:00"));
	assert.equal(before.outsideTerm, true);
	assert.equal(before.next?.date, semester.firstMonday);
	const after = timetableNow(new Date("2027-01-18T08:40:00+08:00"));
	assert.equal(after.outsideTerm, true);
	assert.equal(after.current, undefined);
	assert.equal(after.next, undefined);
});

test("every imported course has valid period endpoints and no teaching-day overlaps", () => {
	assert.equal(courses.length, 14);
	assert.equal(
		new Set(courses.map((course) => course.id)).size,
		courses.length,
	);
	for (const course of courses)
		assert.ok(courseTimes(course).start < courseTimes(course).end);
	for (
		let date = semester.firstMonday;
		date <= semester.lastDate;
		date = addDays(date, 1)
	) {
		const classes = daySchedule(date).courses;
		for (let index = 1; index < classes.length; index++) {
			assert.ok(
				courseTimes(classes[index - 1]).end <=
					courseTimes(classes[index]).start,
				date,
			);
		}
	}
});
