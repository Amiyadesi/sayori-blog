import {
	getPostInteractions,
	handlePostInteractionError,
	postInteractionJson,
	recordPostInteraction,
} from "../_lib/post-interactions.js";

export async function onRequestGet(context) {
	try {
		const result = await getPostInteractions(context);
		return postInteractionJson(result);
	} catch (error) {
		return handlePostInteractionError(error);
	}
}

export async function onRequestPost(context) {
	try {
		const result = await recordPostInteraction(context);
		return postInteractionJson(result);
	} catch (error) {
		return handlePostInteractionError(error);
	}
}
