import assert from "node:assert/strict";
import test from "node:test";

import worker from "../diary-worker.js";

test("diary worker keeps static pages and restricts the Twikoo route", async () => {
	const env = { ASSETS: { fetch: () => new Response("page") } };
	assert.equal((await worker.fetch(new Request("https://diary.sayori.org/"), env)).status, 200);
	assert.equal((await worker.fetch(new Request("https://diary.sayori.org/api/other"), env)).status, 404);
	assert.equal((await worker.fetch(new Request("https://diary.sayori.org/api/twikoo"), env)).status, 405);
	assert.equal(
		(await worker.fetch(new Request("https://diary.sayori.org/api/twikoo", { method: "POST" }), env)).status,
		503,
	);
});
