import { getTwikooAdminToken, twikooBaseUrl } from "./twikoo.js";

const SESSION_COOKIE = "blog_admin_session";
const STATE_COOKIE = "blog_admin_state";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function base64UrlEncodeBytes(bytes) {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeToBytes(value) {
	const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

function fromBase64Url(input) {
	return new TextDecoder().decode(base64UrlDecodeToBytes(input));
}

function toBase64Url(input) {
	return base64UrlEncodeBytes(new TextEncoder().encode(input));
}

async function signValue(secret, value) {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
	return base64UrlEncodeBytes(new Uint8Array(signature));
}

export function json(data, init = {}) {
	const headers = new Headers(JSON_HEADERS);
	if (init.headers) {
		new Headers(init.headers).forEach((value, key) => headers.set(key, value));
	}
	return new Response(JSON.stringify(data), {
		status: init.status || 200,
		headers,
	});
}

export function redirect(location, init = {}) {
	const response = new Response(null, { status: init.status || 302 });
	response.headers.set("location", location);
	if (init.headers) {
		const incoming = new Headers(init.headers);
		incoming.forEach((value, key) => response.headers.append(key, value));
	}
	return response;
}

export function buildCookie(name, value, options = {}) {
	const parts = [`${name}=${value}`];
	parts.push("Path=/");
	parts.push("HttpOnly");
	parts.push("Secure");
	parts.push("SameSite=Lax");
	if (typeof options.maxAge === "number") {
		parts.push(`Max-Age=${options.maxAge}`);
	}
	return parts.join("; ");
}

export function clearCookie(name) {
	return buildCookie(name, "", { maxAge: 0 });
}

export function parseCookies(request) {
	const raw = request.headers.get("cookie") || "";
	return new Map(
		raw
			.split(/;\s*/)
			.filter(Boolean)
			.map((item) => {
				const index = item.indexOf("=");
				if (index === -1) return [item, ""];
				return [item.slice(0, index), decodeURIComponent(item.slice(index + 1))];
			}),
	);
}

export function randomToken(length = 32) {
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function requireEnv(env, keys) {
	for (const key of keys) {
		if (!env[key]) {
			throw json({ success: false, error: `Cloudflare 缺少后台变量 ${key}` }, { status: 500 });
		}
	}
}

export function requireSameOrigin(request) {
	const url = new URL(request.url);
	const origin = request.headers.get("origin");
	if (origin && origin !== url.origin) {
		throw json({ success: false, error: "跨站请求被拒绝" }, { status: 403 });
	}
	const referer = request.headers.get("referer");
	if (!origin && referer) {
		try {
			const refererOrigin = new URL(referer).origin;
			if (refererOrigin !== url.origin) {
				throw json({ success: false, error: "跨站请求被拒绝" }, { status: 403 });
			}
		} catch {
			throw json({ success: false, error: "无效来源请求" }, { status: 403 });
		}
	}
}

export async function createSessionCookie(env, user) {
	requireEnv(env, ["SESSION_SECRET"]);
	const payload = {
		login: user.login,
		name: user.name || user.login,
		avatar_url: user.avatar_url || "",
		exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
	};
	const encodedPayload = toBase64Url(JSON.stringify(payload));
	const signature = await signValue(env.SESSION_SECRET, encodedPayload);
	return buildCookie(SESSION_COOKIE, `${encodedPayload}.${signature}`, { maxAge: SESSION_MAX_AGE });
}

export async function readSession(request, env) {
	if (!env.SESSION_SECRET) return null;
	const token = parseCookies(request).get(SESSION_COOKIE);
	if (!token) return null;
	const [payloadPart, signaturePart] = token.split(".");
	if (!payloadPart || !signaturePart) return null;
	const expected = await signValue(env.SESSION_SECRET, payloadPart);
	if (expected !== signaturePart) return null;
	const payload = JSON.parse(fromBase64Url(payloadPart));
	if (!payload?.login || !payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) {
		return null;
	}
	return payload;
}

export async function requireAdmin(request, env) {
	const session = await readSession(request, env);
	if (!session) {
		throw json({ success: false, error: "请先用 GitHub 登录后台" }, { status: 401 });
	}
	const adminLogin = env.ADMIN_GITHUB_LOGIN || "Amiyadesi";
	if (session.login !== adminLogin) {
		throw json({ success: false, error: `只有 ${adminLogin} 可以进入后台` }, { status: 403 });
	}
	return session;
}

export function getPublicEnv(env) {
	const hasTwikooAdminToken = Boolean(getTwikooAdminToken(env));
	return {
		adminLogin: env.ADMIN_GITHUB_LOGIN || "Amiyadesi",
		oauthConfigured: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.SESSION_SECRET),
		commentOwnerNick: "Amiya_desi",
		commentProxyConfigured: hasTwikooAdminToken,
		twikooAdminAvailable: hasTwikooAdminToken,
		twikooBaseUrl: twikooBaseUrl(env),
	};
}

export function handleError(error) {
	if (error instanceof Response) {
		return error;
	}
	console.error("[blog-admin]", error);
	return json({ success: false, error: "后台接口出错了，请看 Functions 日志" }, { status: 500 });
}

export { SESSION_COOKIE, STATE_COOKIE };
