import { allowedFriendScreenshotUrls } from "../_generated/friend-screenshot-targets.js";

export const SCREENSHOT_CACHE_TTL_SECONDS = 60 * 60;
const SCREENSHOT_STALE_SECONDS = 60 * 60 * 24;
const SCREENSHOT_ENDPOINT_CACHE_TTL_SECONDS = 60 * 60;
const SAME_SITE_HOSTS = new Set([
	"blog.sayori.org",
	"localhost",
	"127.0.0.1",
]);

function textResponse(message, status) {
	return new Response(message, {
		status,
		headers: {
			"cache-control": "no-store",
			"content-type": "text/plain; charset=utf-8",
			"x-content-type-options": "nosniff",
		},
	});
}

function isAllowedSource(request) {
	const requestUrl = new URL(request.url);
	if (isSameSiteHost(requestUrl.hostname)) {
		const origin = request.headers.get("origin");
		if (origin) {
			return isSameSiteUrl(origin);
		}
		const referer = request.headers.get("referer");
		if (referer) {
			return isSameSiteUrl(referer);
		}
		return true;
	}
	return false;
}

function isSameSiteUrl(value) {
	try {
		const url = new URL(value);
		return isSameSiteHost(url.hostname);
	} catch {
		return false;
	}
}

function isSameSiteHost(hostname) {
	const normalized = String(hostname || "").toLowerCase();
	return (
		SAME_SITE_HOSTS.has(normalized) ||
		normalized === "sayori-blog.pages.dev" ||
		normalized.endsWith(".sayori-blog.pages.dev") ||
		normalized.endsWith("--sayori-blog.pages.dev")
	);
}

export function normalizeScreenshotTarget(value) {
	try {
		const url = new URL(String(value || "").trim());
		if (!["http:", "https:"].includes(url.protocol)) {
			return "";
		}
		url.hash = "";
		return url.toString();
	} catch {
		return "";
	}
}

export function isAllowedFriendScreenshotUrl(value) {
	const target = normalizeScreenshotTarget(value);
	return target && allowedFriendScreenshotUrls.includes(target);
}

function buildScreenshotPayload(url, waitUntil) {
	return {
		url,
		bestAttempt: true,
		viewport: { width: 1200, height: 800 },
		gotoOptions: { waitUntil, timeout: 45000 },
		waitForTimeout: 1200,
	};
}

function screenshotResponse(body, extraHeaders = {}) {
	const headers = new Headers({
		"cache-control": `public, max-age=${SCREENSHOT_CACHE_TTL_SECONDS}, stale-while-revalidate=${SCREENSHOT_STALE_SECONDS}`,
		"content-type": "image/png",
		"x-content-type-options": "nosniff",
		...extraHeaders,
	});
	return new Response(body, { status: 200, headers });
}

function getScreenshotCacheBucket(now = Date.now()) {
	return Math.floor(now / (SCREENSHOT_CACHE_TTL_SECONDS * 1000));
}

function buildScreenshotCacheKey(target, now = Date.now()) {
	const bucket = getScreenshotCacheBucket(now);
	return new Request(
		`https://blog.sayori.org/api/screenshot-cache/${encodeURIComponent(target)}?v=${bucket}`,
	);
}

async function requestCloudflareScreenshot(apiUrl, token, url, waitUntil) {
	const response = await fetch(apiUrl.toString(), {
		method: "POST",
		headers: {
			authorization: `Bearer ${token}`,
			"content-type": "application/json",
		},
		body: JSON.stringify(buildScreenshotPayload(url, waitUntil)),
	});

	if (!response.ok) {
		throw new Error(`Cloudflare Browser Rendering failed with ${response.status}`);
	}

	return response.arrayBuffer();
}

async function fetchCloudflareScreenshot(env, url, options = {}) {
	const accountId = String(env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID || "").trim();
	const token = String(env.CF_API_TOKEN || env.CLOUDFLARE_API_TOKEN || "").trim();
	if (!accountId || !token) {
		throw new Error("Cloudflare Browser Rendering credentials are missing");
	}

	const apiUrl = new URL(
		`https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/screenshot`,
	);
	apiUrl.searchParams.set(
		"cacheTTL",
		String(options.forceRefresh ? 0 : SCREENSHOT_ENDPOINT_CACHE_TTL_SECONDS),
	);

	try {
		return await requestCloudflareScreenshot(apiUrl, token, url, "load");
	} catch (error) {
		console.warn("[blog-screenshot] load wait failed, retrying with domcontentloaded", error);
		return requestCloudflareScreenshot(apiUrl, token, url, "domcontentloaded");
	}
}

export async function handleScreenshotRequest(context) {
	const { request, env, waitUntil } = context;
	if (request.method === "OPTIONS") {
		return new Response(null, { status: 204 });
	}
	if (request.method !== "GET" && request.method !== "HEAD") {
		return textResponse("Method not allowed", 405);
	}
	if (!isAllowedSource(request)) {
		return textResponse("Forbidden", 403);
	}

	const requestUrl = new URL(request.url);
	const target = normalizeScreenshotTarget(requestUrl.searchParams.get("url"));
	if (!target) {
		return textResponse("Missing or invalid url", 400);
	}
	if (!isAllowedFriendScreenshotUrl(target)) {
		return textResponse("Screenshot target is not in the friend link allowlist", 403);
	}

	const forceRefresh = requestUrl.searchParams.get("refresh") === "1";
	const cache = caches.default;
	const cacheKey = buildScreenshotCacheKey(target);
	const cached = forceRefresh ? null : await cache.match(cacheKey);
	if (cached) {
		return cached;
	}

	const image = await fetchCloudflareScreenshot(env, target, { forceRefresh });
	const response = screenshotResponse(request.method === "HEAD" ? null : image, {
		"x-sayori-screenshot-cache": "miss",
		...(forceRefresh ? { "x-sayori-screenshot-refresh": "true" } : {}),
	});
	const cacheResponse = screenshotResponse(image, {
		"x-sayori-screenshot-cache": "hit",
	});
	waitUntil?.(cache.put(cacheKey, cacheResponse.clone()));
	return response;
}
