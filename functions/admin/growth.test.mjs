import assert from "node:assert/strict";
import test from "node:test";
import { createSessionCookie } from "../_lib/admin.js";
import { onRequest } from "./growth.js";

const env = {
	ADMIN_GITHUB_LOGIN: "Amiyadesi",
	SESSION_SECRET: "test-only-session-secret",
	N8N_URL: "https://automation.example.test/",
};

test("anonymous crawlers see a noindex login redirect, never the private destination", async () => {
	const response = await onRequest({
		request: new Request("https://blog.sayori.org/admin/growth/?post=/en/posts/example/"),
		env,
	});
	assert.equal(response.status, 302);
	assert.equal(response.headers.get("location"), "/admin/");
	assert.match(response.headers.get("x-robots-tag") || "", /noindex/);
	assert.match(response.headers.get("cache-control"), /private, no-store/);
});

test("only the administrator can follow the private redirect", async () => {
	for (const login of ["Amiyadesi", "another-user"]) {
		const cookie = (await createSessionCookie(env, { login })).split(";", 1)[0];
		const response = await onRequest({
			request: new Request("https://blog.sayori.org/admin/growth/", { headers: { cookie } }),
			env,
		});
		assert.equal(response.status, login === "Amiyadesi" ? 302 : 403);
		assert.equal(response.headers.get("location"), login === "Amiyadesi" ? env.N8N_URL : null);
	}
});
