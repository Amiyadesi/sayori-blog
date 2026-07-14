import { createSessionCookie, clearCookie, json, parseCookies, redirect, requireEnv, STATE_COOKIE, handleError } from "../../_lib/admin.js";

async function exchangeCode(env, code, redirectUri) {
	const response = await fetch("https://github.com/login/oauth/access_token", {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
			"User-Agent": "sayori-blog-admin",
		},
		body: JSON.stringify({
			client_id: env.GITHUB_CLIENT_ID,
			client_secret: env.GITHUB_CLIENT_SECRET,
			code,
			redirect_uri: redirectUri,
		}),
	});
	const data = await response.json();
	if (!response.ok || data.error || !data.access_token) {
		throw json(
			{ success: false, error: data.error_description || "GitHub OAuth 换取 token 失败" },
			{ status: 502 },
		);
	}
	return data.access_token;
}

async function fetchGitHubUser(accessToken) {
	const response = await fetch("https://api.github.com/user", {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
			"User-Agent": "sayori-blog-admin",
		},
	});
	const data = await response.json();
	if (!response.ok) {
		throw json({ success: false, error: "GitHub 用户信息读取失败" }, { status: 502 });
	}
	return data;
}

export async function onRequestGet(context) {
	try {
		const { env, request } = context;
		requireEnv(env, ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "SESSION_SECRET"]);
		const url = new URL(request.url);
		const code = url.searchParams.get("code");
		const state = url.searchParams.get("state");
		const savedState = parseCookies(request).get(STATE_COOKIE);
		if (!code || !state || !savedState || state !== savedState) {
			return json({ success: false, error: "GitHub 登录 state 校验失败，请重新登录" }, { status: 400 });
		}

		const token = await exchangeCode(env, code, `${url.origin}/api/auth/callback`);
		const user = await fetchGitHubUser(token);
		const adminLogin = env.ADMIN_GITHUB_LOGIN || "Amiyadesi";
		if (user.login !== adminLogin) {
			return json({ success: false, error: `只有 ${adminLogin} 可以进入后台` }, { status: 403 });
		}

		const sessionCookie = await createSessionCookie(env, user);
		const response = redirect("/admin/");
		response.headers.append("set-cookie", sessionCookie);
		response.headers.append("set-cookie", clearCookie(STATE_COOKIE));
		return response;
	} catch (error) {
		return handleError(error);
	}
}
