import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSessionCookie } from "../../_lib/admin.js";
import { onRequestGet, onRequestPut } from "./file.js";

describe("retired web writing API", () => {
	it("returns 410 to an authenticated administrator", async () => {
		const env = {
			ADMIN_GITHUB_LOGIN: "Amiyadesi",
			SESSION_SECRET: "test-only-session-secret",
		};
		const setCookie = await createSessionCookie(env, {
			login: "Amiyadesi",
			name: "Amiya",
		});
		const cookie = setCookie.split(";", 1)[0];

		for (const [method, handler] of [
			["GET", onRequestGet],
			["PUT", onRequestPut],
		]) {
			const response = await handler({
				request: new Request("https://blog.sayori.org/api/admin/file", {
					method,
					headers: { cookie },
				}),
				env,
			});

			assert.equal(response.status, 410);
			assert.deepEqual(await response.json(), {
				success: false,
				error: "网页后台写作已封印；请从 Obsidian 插件发布文章。",
			});
		}
	});

	it("still requires authentication before returning the retired response", async () => {
		const response = await onRequestGet({
			request: new Request("https://blog.sayori.org/api/admin/file"),
			env: { SESSION_SECRET: "test-only-session-secret" },
		});

		assert.equal(response.status, 401);
	});
});
