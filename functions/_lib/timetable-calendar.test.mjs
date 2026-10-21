import assert from "node:assert/strict";
import { test } from "node:test";
import { publicCalendarEvent, readCalendarEvents, calendarWindow } from "./timetable-calendar.js";

const event = (values = {}) => ({
	status: "confirmed",
	summary: "数据结构｜明德楼-210",
	description: "【上课提醒】数据结构 教师：不公开",
	location: "浙江科技大学安吉校区 明德楼-210",
	start: { dateTime: "2026-10-20T08:40:00+08:00" },
	end: { dateTime: "2026-10-20T10:15:00+08:00" },
	...values,
});

test("only courses and independently tagged titles become public; private details never leave", () => {
	const course = publicCalendarEvent(event({ attendees: [{ email: "private@example.com" }] }));
	assert.deepEqual(course, {
		title: "数据结构",
		location: "浙江科技大学安吉校区 明德楼-210",
		start: "2026-10-20T00:40:00.000Z",
		end: "2026-10-20T02:15:00.000Z",
		course: true,
	});
	const marked = publicCalendarEvent(event({ summary: "社团见面 #博客", description: "私人备注" }));
	assert.equal(marked.title, "社团见面");
	assert.equal(marked.course, false);
	assert.equal(publicCalendarEvent(event({ summary: "私人计划", description: "#博客" })), null);
	assert.equal(publicCalendarEvent(event({ summary: "私人计划 #博客密码", description: "" })), null);
	assert.equal(publicCalendarEvent(event({ summary: "私人计划", description: "正文提到了【上课提醒】" })), null);
	assert.equal(JSON.stringify([course, marked]).includes("private@example.com"), false);
	assert.equal(JSON.stringify([course, marked]).includes("教师"), false);
});

test("cancelled, declined and explicitly private events stay hidden, including tagged ones", () => {
	for (const values of [
		{ status: "cancelled" },
		{ visibility: "private" },
		{ attendees: [{ self: true, responseStatus: "declined" }] },
	]) assert.equal(publicCalendarEvent(event({ summary: "见面 #博客", ...values })), null);
});

test("all-day dates keep exclusive ends, edited times/rooms are authoritative and invalid public dates fail", () => {
	assert.deepEqual(publicCalendarEvent(event({
		summary: "活动 #博客", description: "", start: { date: "2026-10-24" }, end: { date: "2026-10-26" },
	})), { title: "活动", location: "浙江科技大学安吉校区 明德楼-210", start: "2026-10-24", end: "2026-10-26", course: false });
	const edited = publicCalendarEvent(event({ location: "新教室", start: { dateTime: "2026-10-20T11:00:00+08:00" }, end: { dateTime: "2026-10-20T12:00:00+08:00" } }));
	assert.equal(edited.location, "新教室");
	assert.equal(edited.start, "2026-10-20T03:00:00.000Z");
	assert.throws(() => publicCalendarEvent(event({ end: { dateTime: "2026-10-19T12:00:00Z" } })), /Invalid calendar event/);
	assert.throws(() => publicCalendarEvent(event({ start: { date: "2026-02-30" }, end: { date: "2026-03-03" } })), /Invalid calendar event/);
});

test("Google expands recurrences and exceptions; every page is filtered before returning", async () => {
	const calls = [];
	const result = await readCalendarEvents("calendar@example.com", "test-token", async (url, init) => {
		const request = new URL(url);
		calls.push(request);
		assert.equal(init.headers.authorization, "Bearer test-token");
		assert.equal(request.searchParams.get("singleEvents"), "true");
		assert.equal(request.searchParams.get("showDeleted"), "false");
		assert.ok(request.searchParams.get("fields").includes("description"));
		return Response.json(request.searchParams.has("pageToken")
			? { items: [event({ summary: "见面 #博客", description: "" })] }
			: { items: [event(), event({ summary: "私人计划", description: "" }), event({ status: "cancelled" })], nextPageToken: "page-2" });
	}, new Date("2026-10-21T12:00:00+08:00"));
	assert.equal(calls.length, 2);
	assert.equal(calls[1].searchParams.get("pageToken"), "page-2");
	assert.equal(result.events.length, 2);
	assert.equal(JSON.stringify(result).includes("calendar@example.com"), false);
	assert.ok(result.rangeStart < "2026-09-07" && result.rangeEnd > "2027-01-18");
	assert.equal(new Date(`${result.rangeStart}T00:00:00Z`).getUTCDay(), 1);
	assert.equal(calendarWindow(new Date("2026-10-21T16:30:00Z")).rangeStart, result.rangeStart);
});

test("upstream failures never become an empty or partly published calendar", async () => {
	await assert.rejects(() => readCalendarEvents("test", "token", async () => new Response("private upstream details", { status: 403 })), /Calendar source unavailable/);
	await assert.rejects(() => readCalendarEvents("test", "token", async () => Response.json({ items: "invalid" })), /Invalid calendar response/);
});
