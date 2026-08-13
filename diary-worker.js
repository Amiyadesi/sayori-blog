function json(value, status = 200) {
	return new Response(JSON.stringify(value), {
		status,
		headers: { "content-type": "application/json; charset=utf-8" },
	});
}

async function twikoo(request, env) {
	if (request.method === "OPTIONS") return new Response(null, { status: 204 });
	if (request.method !== "POST") {
		return json({ success: false, error: "Twikoo proxy only accepts POST" }, 405);
	}

	const target = String(env.TWIKOO_PROXY_URL || "").trim();
	if (!target) {
		return json({ success: false, error: "Twikoo proxy is not configured" }, 503);
	}

	try {
		const headers = new Headers({
			"content-type": "application/json",
			accept: "application/json",
		});
		const token = request.headers.get("x-sayori-comment-token");
		if (token) headers.set("x-sayori-comment-token", token);
		const response = await fetch(target, {
			method: "POST",
			headers,
			body: await request.text(),
		});
		const responseHeaders = new Headers(response.headers);
		responseHeaders.delete("content-encoding");
		responseHeaders.delete("content-length");
		responseHeaders.delete("set-cookie");
		responseHeaders.set("cache-control", "no-store");
		return new Response(response.body, { status: response.status, headers: responseHeaders });
	} catch {
		return json({ success: false, error: "Twikoo proxy request failed" }, 502);
	}
}

export default {
	async fetch(request, env) {
		const path = new URL(request.url).pathname;
		if (path === "/api/twikoo") return twikoo(request, env);
		if (path.startsWith("/api/")) return new Response("Not Found", { status: 404 });
		return env.ASSETS.fetch(request);
	},
};
