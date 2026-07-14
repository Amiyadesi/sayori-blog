import { buildCookie, randomToken, redirect, STATE_COOKIE, requireEnv, handleError } from "../../_lib/admin.js";

export async function onRequestGet(context) {
	try {
		const { env, request } = context;
		requireEnv(env, ["GITHUB_CLIENT_ID"]);
		const url = new URL(request.url);
		const state = randomToken(32);
		const callbackUrl = `${url.origin}/api/auth/callback`;
		const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
		authorizeUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
		authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
		authorizeUrl.searchParams.set("scope", "read:user");
		authorizeUrl.searchParams.set("state", state);
		return redirect(authorizeUrl.toString(), {
			headers: {
				"set-cookie": buildCookie(STATE_COOKIE, state, { maxAge: 600 }),
			},
		});
	} catch (error) {
		return handleError(error);
	}
}
