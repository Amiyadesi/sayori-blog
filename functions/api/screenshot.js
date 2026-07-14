import { handleScreenshotRequest } from "../_lib/screenshot.js";

export async function onRequest(context) {
	try {
		return await handleScreenshotRequest(context);
	} catch (error) {
		console.error("[blog-screenshot]", error);
		return new Response("Screenshot generation failed", {
			status: 502,
			headers: {
				"cache-control": "no-store",
				"content-type": "text/plain; charset=utf-8",
				"x-content-type-options": "nosniff",
			},
		});
	}
}
