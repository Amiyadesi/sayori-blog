import assert from "node:assert/strict";
import { test } from "node:test";
import { onRequestGet } from "./timetable.js";

const snapshot = { rangeStart: "2026-04-20", rangeEnd: "2027-04-26", syncedAt: "2026-10-21T00:00:00.000Z", events: [{ title: "数据结构", location: "图书馆", start: "2026-10-21", end: "2026-10-22", course: true, description: "private" }], calendarId: "private@example.com" };
const context = (locale, body) => ({ request: new Request(`https://blog.sayori.org/api/timetable?locale=${locale}`), env: { SAYORI_ANALYTICS_DB: { prepare: () => ({ first: async () => body === undefined ? null : { body: JSON.stringify(body) } }) } } });

test("public API projects only allowed fields and converts Traditional Chinese", async () => {
	const response = await onRequestGet(context("zh-Hant", snapshot));
	assert.equal(response.status, 200);
	assert.equal(response.headers.get("x-robots-tag"), "noindex");
	assert.equal(response.headers.get("cache-control"), "no-store");
	const body = await response.json();
	assert.equal(body.events[0].title, "數據結構");
	assert.equal(body.events[0].location, "圖書館");
	assert.equal(JSON.stringify(body).includes("private"), false);
});

test("missing snapshots, malformed storage and invalid locales are explicit failures", async () => {
	assert.equal((await onRequestGet(context("en"))).status, 503);
	assert.equal((await onRequestGet(context("en", {}))).status, 503);
	assert.equal((await onRequestGet(context("invalid", snapshot))).status, 400);
});
