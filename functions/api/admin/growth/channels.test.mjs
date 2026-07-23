import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSessionCookie } from "../../../_lib/admin.js";
import { onRequestDelete, onRequestPost } from "./channels.js";

async function adminCookie() {
	const cookie = await createSessionCookie(
		{ SESSION_SECRET: "test-only-session-secret" },
		{ login: "Amiyadesi", name: "Amiya" },
	);
	return cookie.split(";", 1)[0];
}

describe("growth channel management API", () => {
	it("requires an authenticated administrator for writes", async () => {
		const response = await onRequestPost({
			request: new Request("https://blog.sayori.org/api/admin/growth/channels", {
				method: "POST",
				body: "{}",
			}),
			env: { SESSION_SECRET: "test-only-session-secret" },
		});
		assert.equal(response.status, 401);
	});

	it("rejects cross-origin POST and DELETE before accessing D1", async () => {
		for (const [method, handler] of [
			["POST", onRequestPost],
			["DELETE", onRequestDelete],
		]) {
			const response = await handler({
				request: new Request("https://blog.sayori.org/api/admin/growth/channels", {
					method,
					headers: {
						cookie: await adminCookie(),
						origin: "https://example.com",
						"content-type": "application/json",
					},
					body: "{}",
				}),
				env: { SESSION_SECRET: "test-only-session-secret" },
			});
			assert.equal(response.status, 403);
		}
	});
});
