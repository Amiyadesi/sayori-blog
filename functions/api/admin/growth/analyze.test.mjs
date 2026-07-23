import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSessionCookie } from "../../../_lib/admin.js";
import { onRequestPost } from "./analyze.js";

async function adminCookie() {
	const cookie = await createSessionCookie(
		{ SESSION_SECRET: "test-only-session-secret" },
		{ login: "Amiyadesi", name: "Amiya" },
	);
	return cookie.split(";", 1)[0];
}

describe("growth analysis API", () => {
	it("requires the existing GitHub admin session", async () => {
		const response = await onRequestPost({
			request: new Request("https://blog.sayori.org/api/admin/growth/analyze", {
				method: "POST",
				body: "{}",
			}),
			env: { SESSION_SECRET: "test-only-session-secret" },
		});
		assert.equal(response.status, 401);
	});

	it("rejects cross-origin writes before touching external sources", async () => {
		const response = await onRequestPost({
			request: new Request("https://blog.sayori.org/api/admin/growth/analyze", {
				method: "POST",
				headers: {
					cookie: await adminCookie(),
					origin: "https://example.com",
					"content-type": "application/json",
				},
				body: JSON.stringify({ targetUrl: "https://blog.sayori.org/posts/a/", queries: ["a"] }),
			}),
			env: { SESSION_SECRET: "test-only-session-secret" },
		});
		assert.equal(response.status, 403);
	});

	it("fails loudly when the growth D1 binding is missing", async () => {
		const response = await onRequestPost({
			request: new Request("https://blog.sayori.org/api/admin/growth/analyze", {
				method: "POST",
				headers: {
					cookie: await adminCookie(),
					origin: "https://blog.sayori.org",
					"content-type": "application/json",
				},
				body: JSON.stringify({ targetUrl: "https://blog.sayori.org/posts/a/", queries: ["a"] }),
			}),
			env: { SESSION_SECRET: "test-only-session-secret" },
		});
		assert.equal(response.status, 503);
	});
});
