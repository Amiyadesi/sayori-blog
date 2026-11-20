export async function onRequestPost({ request, env }) {
	const { origin } = new URL(request.url);
	if (origin !== "https://blog.sayori.org" || request.headers.get("Origin") !== origin) {
		return new Response(null, { status: 403 });
	}
	// Pages can expose an empty POST as a stream; there is no payload to parse.
	await env.SAYORI_ANALYTICS_DB.prepare(
		`INSERT INTO blog_pageviews (hour_start, pageviews) VALUES (?, 1)
		ON CONFLICT(hour_start) DO UPDATE SET pageviews = pageviews + 1`,
	).bind(Math.floor(Date.now() / 3_600_000) * 3_600_000).run();
	return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
