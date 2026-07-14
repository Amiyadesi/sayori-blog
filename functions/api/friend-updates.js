import { handleFriendUpdatesRequest } from "../_lib/friend-updates.js";

export async function onRequest(context) {
	try {
		return await handleFriendUpdatesRequest(context);
	} catch (error) {
		console.error("[friend-updates]", error);
		return new Response("Friend updates unavailable", {
			status: 502,
			headers: {
				"cache-control": "no-store",
				"content-type": "text/plain; charset=utf-8",
				"x-content-type-options": "nosniff",
			},
		});
	}
}
