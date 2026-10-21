import assert from "node:assert/strict";
import { test } from "node:test";
import {
	calendarDay,
	calendarNow,
	calendarPoint,
	parseCalendarSnapshot,
	type CalendarEvent,
} from "./timetable-calendar";

const event: CalendarEvent = {
	title: "数据结构",
	location: "新教室",
	start: "2026-10-20T00:40:00.000Z",
	end: "2026-10-20T02:15:00.000Z",
	course: true,
};

test("calendar edits and cancellations are authoritative; Beijing clock and class breaks remain accurate", () => {
	assert.deepEqual(calendarPoint(event.start), {
		date: "2026-10-20",
		time: "08:40",
	});
	assert.equal(
		calendarNow([event], new Date("2026-10-20T01:25:00Z")).phase,
		"break",
	);
	assert.equal(
		calendarNow([event], new Date("2026-10-20T01:30:00Z")).period?.number,
		2,
	);
	assert.equal(calendarNow([event], new Date(event.end)).current, undefined);
	assert.equal(calendarNow([], new Date(event.start)).next, undefined);
	const changed = {
		...event,
		start: "2026-10-20T04:40:00.000Z",
		end: "2026-10-20T05:10:00.000Z",
	};
	assert.equal(
		calendarNow([changed], new Date("2026-10-20T04:50:00Z")).phase,
		"class",
	);
	assert.equal(
		calendarNow([changed], new Date("2026-10-20T04:50:00Z")).current
			?.location,
		"新教室",
	);
});

test("all-day exclusive ends and timed midnight crossings appear on exactly their occupied dates", () => {
	const allDay = {
		...event,
		course: false,
		start: "2026-10-23",
		end: "2026-10-25",
	};
	const overnight = {
		...event,
		course: false,
		start: "2026-10-22T15:00:00.000Z",
		end: "2026-10-22T17:00:00.000Z",
	};
	assert.equal(calendarDay([allDay, overnight], "2026-10-22").length, 1);
	assert.equal(calendarDay([allDay, overnight], "2026-10-23").length, 2);
	assert.equal(calendarDay([allDay, overnight], "2026-10-24").length, 1);
	assert.equal(calendarDay([allDay, overnight], "2026-10-25").length, 0);
	assert.equal(
		calendarNow([allDay, overnight], new Date("2026-10-22T16:30:00Z"))
			.current,
		overnight,
	);
	assert.equal(
		calendarNow([allDay], new Date("2026-10-24T16:00:00Z")).current,
		undefined,
	);
});

test("malformed public snapshots fail at the network boundary", () => {
	const snapshot = {
		rangeStart: "2026-04-20",
		rangeEnd: "2027-04-26",
		syncedAt: "2026-10-21T00:00:00Z",
		events: [event],
	};
	assert.equal(parseCalendarSnapshot(snapshot), snapshot);
	assert.throws(() =>
		parseCalendarSnapshot({ ...snapshot, rangeStart: "2026-02-30" }),
	);
	assert.throws(() =>
		parseCalendarSnapshot({
			...snapshot,
			events: [{ ...event, end: "invalid" }],
		}),
	);
	assert.throws(() =>
		parseCalendarSnapshot({
			...snapshot,
			events: [{ ...event, start: event.end }],
		}),
	);
	assert.throws(() =>
		parseCalendarSnapshot({
			...snapshot,
			events: [{ ...event, title: undefined }],
		}),
	);
});
