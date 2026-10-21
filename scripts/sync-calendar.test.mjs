import assert from "node:assert/strict";
import { test } from "node:test";
import { syncCalendar } from "./sync-calendar.mjs";

const env = { GOOGLE_CALENDAR_ID: "private@example.com", GOOGLE_ACCESS_TOKEN: "google-token", CLOUDFLARE_ACCOUNT_ID: "a".repeat(32), CLOUDFLARE_API_TOKEN: "cf-token" };
const event = { summary: "见面 #博客", description: "不公开备注", location: "图书馆", start: { dateTime: "2026-10-21T10:00:00+08:00" }, end: { dateTime: "2026-10-21T11:00:00+08:00" } };

test("sync writes only the filtered snapshot with SQL parameters and fails on D1 errors", async () => {
	const calls = [];
	const fetcher = async (url, init) => {
		calls.push(url);
		if (url.startsWith("https://www.googleapis.com/")) return Response.json({ items: [event, { ...event, summary: "私人计划" }] });
		assert.equal(init.headers.authorization, "Bearer cf-token");
		const query = JSON.parse(init.body);
		assert.ok(query.sql.includes("VALUES (1, ?, ?)"));
		assert.ok(query.sql.includes("excluded.synced_at > timetable_calendar.synced_at"));
		const body = JSON.parse(query.params[0]);
		assert.equal(body.events.length, 1);
		assert.deepEqual(Object.keys(body.events[0]), ["title", "location", "start", "end", "course"]);
		assert.equal(query.params[0].includes("不公开备注"), false);
		assert.equal(query.params[0].includes("private@example.com"), false);
		assert.equal(body.syncedAt, query.params[1]);
		return Response.json({ success: true, result: [{ success: true }] });
	};
	assert.equal((await syncCalendar(env, fetcher)).count, 1);
	assert.equal(calls.length, 2);
	await assert.rejects(() => syncCalendar(env, async (url) => url.startsWith("https://www.googleapis.com/") ? Response.json({ items: [] }) : Response.json({ success: false })), /storage write failed/);
});

test("an incomplete Google read never overwrites the last stored snapshot", async () => {
	let calls = 0;
	await assert.rejects(() => syncCalendar(env, async (url) => {
		assert.ok(url.startsWith("https://www.googleapis.com/"));
		return ++calls === 1 ? Response.json({ items: [event], nextPageToken: "two" }) : new Response(null, { status: 403 });
	}), /Calendar source unavailable/);
	assert.equal(calls, 2);
});
