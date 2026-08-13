import { handleError, json, requireAdmin } from "../_lib/admin.js";
import {
	forwardTwikoo,
	getTwikooAdminToken,
	readTwikooJson,
} from "../_lib/twikoo.js";

const OWNER_NICK = "Amiya_desi";
const OWNER_AVATAR = "https://blog.sayori.org/assets/profile/avatar-sayori.png";
const SAYORI_NICK = "Sayori";
const SAYORI_AVATAR =
	"https://blog.sayori.org/assets/profile/avatar-sayori.png";

function isOwnerNick(value) {
	return (
		String(value || "")
			.trim()
			.toLowerCase() === OWNER_NICK.toLowerCase()
	);
}

function isSayoriNick(value) {
	return (
		String(value || "")
			.trim()
			.toLowerCase() === SAYORI_NICK.toLowerCase()
	);
}

function getSubmitNick(event) {
	return event?.nick || event?.comment?.nick || "";
}

function shouldAttachAdminToken(event) {
	return (
		event.event === "COMMENT_SUBMIT" && isOwnerNick(getSubmitNick(event))
	);
}

function shouldAttachSayoriToken(event) {
	return (
		event.event === "COMMENT_SUBMIT" && isSayoriNick(getSubmitNick(event))
	);
}

function getAdminToken(env) {
	return getTwikooAdminToken(env);
}

async function hasValidSayoriToken(request, env) {
	const expected = String(env.SAYORI_COMMENT_TOKEN || "").trim();
	const provided = String(
		request.headers.get("x-sayori-comment-token") || "",
	).trim();
	if (!expected || !provided || expected.length !== provided.length) {
		return false;
	}
	const encoder = new TextEncoder();
	const [expectedHash, providedHash] = await Promise.all([
		crypto.subtle.digest("SHA-256", encoder.encode(expected)),
		crypto.subtle.digest("SHA-256", encoder.encode(provided)),
	]);
	const left = new Uint8Array(expectedHash);
	const right = new Uint8Array(providedHash);
	let difference = 0;
	for (let index = 0; index < left.length; index += 1) {
		difference |= left[index] ^ right[index];
	}
	return difference === 0;
}

function normalizeOwnerProfile(payload) {
	if (isOwnerNick(payload.nick)) {
		payload.nick = OWNER_NICK;
		payload.avatar = OWNER_AVATAR;
	}
	if (payload.comment && isOwnerNick(payload.comment.nick)) {
		payload.comment.nick = OWNER_NICK;
		payload.comment.avatar = OWNER_AVATAR;
	}
}

function normalizeSayoriProfile(payload) {
	if (isSayoriNick(payload.nick)) {
		payload.nick = SAYORI_NICK;
		payload.avatar = SAYORI_AVATAR;
	}
	if (payload.comment && isSayoriNick(payload.comment.nick)) {
		payload.comment.nick = SAYORI_NICK;
		payload.comment.avatar = SAYORI_AVATAR;
	}
}

async function attachAdminIdentity(request, env, payload, options = {}) {
	await requireAdmin(request, env);
	const token = getAdminToken(env);
	if (!token && options.requireToken) {
		throw json(
			{
				success: false,
				error: "Cloudflare 缺少 TWIKOO_ADMIN_PASSWORD，不能使用站长保留昵称评论",
			},
			{ status: 500 },
		);
	}
	if (token) {
		payload.accessToken = token;
	}
	normalizeOwnerProfile(payload);
	return Boolean(token);
}

async function tryAttachAdminIdentity(request, env, payload) {
	try {
		return await attachAdminIdentity(request, env, payload);
	} catch {
		return false;
	}
}

async function attachSayoriIdentity(request, env, payload) {
	if (!(await hasValidSayoriToken(request, env))) {
		throw json(
			{ success: false, error: "Sayori 评论身份验证失败" },
			{ status: 403 },
		);
	}
	const token = getAdminToken(env);
	if (!token) {
		throw json(
			{
				success: false,
				error: "Cloudflare 缺少 TWIKOO_ADMIN_PASSWORD，不能使用 Sayori 评论身份",
			},
			{ status: 500 },
		);
	}
	payload.accessToken = token;
	normalizeSayoriProfile(payload);
	return true;
}

async function readPayload(request) {
	return request.json().catch(() => ({}));
}

function proxiedResponse(response, diagnostics = {}) {
	const headers = new Headers(response.headers);
	headers.set("cache-control", "no-store");
	headers.delete("content-encoding");
	headers.delete("content-length");
	headers.delete("set-cookie");
	for (const [key, value] of Object.entries(diagnostics)) {
		if (value) {
			headers.set(key, value);
		}
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

function shouldRetryWithAdmin(payload, result) {
	if (payload.event !== "COMMENT_SUBMIT" || !result || result.code === 0) {
		return false;
	}
	const message = String(result.message || "");
	return message.includes("保留昵称") || message.includes("博主身份");
}

function buildSubmitDiagnostics(payload, hasAdminIdentity, tokenInjected) {
	if (payload.event !== "COMMENT_SUBMIT") {
		return {};
	}
	return {
		"x-sayori-twikoo-event": "COMMENT_SUBMIT",
		"x-sayori-owner-nick": isOwnerNick(getSubmitNick(payload))
			? "yes"
			: "no",
		"x-sayori-admin-session": hasAdminIdentity ? "present" : "missing",
		"x-sayori-admin-token": tokenInjected ? "injected" : "not-injected",
	};
}

function adminTokenRejectedResponse(result) {
	return json(
		{
			code: result?.code || 1,
			message:
				"Twikoo 管理员密码没有通过校验，请重新写入 Cloudflare Pages Secret：TWIKOO_ADMIN_PASSWORD",
			success: false,
		},
		{
			status: 502,
			headers: {
				"x-sayori-twikoo-event": "COMMENT_SUBMIT",
				"x-sayori-owner-nick": "yes",
				"x-sayori-admin-session": "present",
				"x-sayori-admin-token": "injected",
			},
		},
	);
}

export async function onRequest(context) {
	try {
		const { env, request } = context;
		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204 });
		}
		if (request.method !== "POST") {
			return json(
				{ success: false, error: "Twikoo proxy only accepts POST" },
				{ status: 405 },
			);
		}

		const payload = await readPayload(request);
		const needsAdminIdentity = shouldAttachAdminToken(payload);
		const needsSayoriIdentity = shouldAttachSayoriToken(payload);
		let hasAdminIdentity = false;
		let tokenInjected = false;
		if (needsSayoriIdentity) {
			tokenInjected = await attachSayoriIdentity(request, env, payload);
			hasAdminIdentity = true;
		} else if (needsAdminIdentity) {
			tokenInjected = await attachAdminIdentity(request, env, payload, {
				requireToken: true,
			});
			hasAdminIdentity = true;
		} else if (payload.event === "COMMENT_SUBMIT" && getAdminToken(env)) {
			tokenInjected = await tryAttachAdminIdentity(request, env, payload);
			hasAdminIdentity = tokenInjected;
		}

		let response = await forwardTwikoo(env, payload);
		let result = await readTwikooJson(response);
		if (
			!hasAdminIdentity &&
			getAdminToken(env) &&
			shouldRetryWithAdmin(payload, result)
		) {
			tokenInjected = await tryAttachAdminIdentity(request, env, payload);
			hasAdminIdentity = tokenInjected;
			if (tokenInjected) {
				response = await forwardTwikoo(env, payload);
				result = await readTwikooJson(response);
			}
		}
		if (
			hasAdminIdentity &&
			tokenInjected &&
			isOwnerNick(getSubmitNick(payload)) &&
			shouldRetryWithAdmin(payload, result)
		) {
			return adminTokenRejectedResponse(result);
		}
		return proxiedResponse(
			response,
			buildSubmitDiagnostics(payload, hasAdminIdentity, tokenInjected),
		);
	} catch (error) {
		return handleError(error);
	}
}
