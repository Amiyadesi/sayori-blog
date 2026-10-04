import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { createSessionCookie } from "../functions/_lib/admin.js";
import { onRequest } from "../functions/admin/growth.js";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("post engagement sharing", () => {
	const script = read("src/scripts/post-engagement.ts");

	it("shows only copy, supported native sharing, poster, and an authenticated growth shortcut", () => {
		const source = read("src/components/features/posts/PostEngagement.astro");
		assert.match(source, /data-copy-share/);
		assert.match(source, /data-native-share hidden/);
		assert.match(source, /postGeneratePoster/);
		assert.match(source, /<template data-promote-template>[\s\S]*post-promote-link[\s\S]*<\/template>/);
		assert.doesNotMatch(source, /data-promote-post/);
		assert.match(script, /link.href = "\/admin\/growth\/"/);
		assert.doesNotMatch(source, /PUBLIC_N8N_URL|n8n\.sayori\.org/);
		assert.doesNotMatch(source, /service\.weibo\.com|twitter\.com\/intent|t\.me\/share|facebook\.com\/sharer/);
		assert.doesNotMatch(source, /data-share-count/);
	});

	it("tracks a share only after copy, native share, or poster success", () => {
		const poster = read("src/components/misc/SharePoster.svelte");
		assert.match(script, /copyTextWithFeedback\(url\)[\s\S]*\.then\(\(\) => track\("share", "copy"/);
		assert.match(script, /navigator[\s\S]*\.share\(\{ title, url \}\)[\s\S]*\.then\(\(\) => track\("share", "native"/);
		assert.match(script, /error\.name === "AbortError"/);
		assert.match(poster, /sayori:share-success/);
	});

	it("provides a selected-text fallback when clipboard copying fails", () => {
		const source = read("src/components/features/posts/PostEngagement.astro");
		assert.match(source, /data-copy-fallback-input/);
		assert.match(script, /copyFallbackInput\.select\(\)/);
	});

	it("shows visible poster download feedback before recording success", () => {
		const poster = read("src/components/misc/SharePoster.svelte");
		assert.match(poster, /downloaded = true/);
		assert.match(poster, /postPosterDownloadStarted/);
		assert.ok(
			poster.indexOf("downloaded = true") <
				poster.indexOf('new CustomEvent("sayori:share-success"'),
		);
	});
});

describe("private n8n entry", () => {
	const env = {
		ADMIN_GITHUB_LOGIN: "Amiyadesi",
		SESSION_SECRET: "test-only-session-secret",
	};

	async function requestWithLogin(login?: string) {
		const headers = new Headers();
		if (login) {
			const cookie = await createSessionCookie(env, { login });
			headers.set("cookie", cookie.split(";", 1)[0]);
		}
		return new Request("https://blog.sayori.org/admin/growth/", { headers });
	}

	it("sends anonymous visitors to the login page without revealing n8n", async () => {
		const response = await onRequest({ request: await requestWithLogin(), env });
		assert.equal(response.status, 302);
		assert.equal(response.headers.get("location"), "/admin/");
		assert.match(response.headers.get("cache-control") || "", /private, no-store/);
	});

	it("rejects a signed session belonging to another user", async () => {
		const response = await onRequest({ request: await requestWithLogin("visitor"), env });
		assert.equal(response.status, 403);
		assert.equal(response.headers.get("location"), null);
		assert.doesNotMatch(await response.text(), /n8n\.sayori\.org/);
	});

	it("redirects only the logged-in owner to n8n without caching the redirect", async () => {
		const response = await onRequest({ request: await requestWithLogin("Amiyadesi"), env });
		assert.equal(response.status, 302);
		assert.equal(response.headers.get("location"), "https://n8n.sayori.org/");
		assert.match(response.headers.get("cache-control") || "", /private, no-store/);
	});
});
