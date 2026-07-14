export function twikooBaseUrl(env) {
	return (env.TWIKOO_BASE_URL || "https://comments.sayori.org").replace(/\/+$/, "");
}

export function getTwikooAdminToken(env) {
	return typeof env.TWIKOO_ADMIN_PASSWORD === "string"
		? env.TWIKOO_ADMIN_PASSWORD.trim()
		: "";
}

export async function forwardTwikoo(env, payload) {
	return fetch(twikooBaseUrl(env), {
		method: "POST",
		headers: {
			"content-type": "application/json",
			accept: "application/json",
		},
		body: JSON.stringify(payload),
	});
}

export async function readTwikooJson(response) {
	return response.clone().json().catch(() => null);
}
