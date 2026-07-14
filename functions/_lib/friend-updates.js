import { friendUpdateSources } from "../_generated/friend-update-sources.js";

const FRIEND_UPDATES_CACHE_TTL_SECONDS = 60 * 30;
const FRIEND_UPDATES_STALE_SECONDS = 60 * 60 * 12;
const FEED_TIMEOUT_MS = 8000;
const MAX_FEED_BYTES = 512 * 1024;
const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 12;

function jsonResponse(data, status = 200, extraHeaders = {}) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"cache-control": `public, max-age=${FRIEND_UPDATES_CACHE_TTL_SECONDS}, stale-while-revalidate=${FRIEND_UPDATES_STALE_SECONDS}`,
			"content-type": "application/json; charset=utf-8",
			"x-content-type-options": "nosniff",
			...extraHeaders,
		},
	});
}

function errorResponse(message, status) {
	return new Response(message, {
		status,
		headers: {
			"cache-control": "no-store",
			"content-type": "text/plain; charset=utf-8",
			"x-content-type-options": "nosniff",
		},
	});
}

function clampLimit(value) {
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed)) {
		return DEFAULT_LIMIT;
	}
	return Math.min(Math.max(parsed, 1), MAX_LIMIT);
}

function decodeXml(value) {
	return String(value || "")
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x([0-9a-f]+);/gi, (_match, hex) =>
			String.fromCodePoint(Number.parseInt(hex, 16)),
		)
		.replace(/&#(\d+);/g, (_match, code) =>
			String.fromCodePoint(Number.parseInt(code, 10)),
		);
}

function stripHtml(value) {
	return decodeXml(value)
		.replace(/<script\b[\s\S]*?<\/script>/gi, " ")
		.replace(/<style\b[\s\S]*?<\/style>/gi, " ")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/p>/gi, "\n")
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function cleanText(value, maxLength = 160) {
	const text = stripHtml(value);
	if (text.length <= maxLength) {
		return text;
	}
	return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function extractTag(block, tagNames) {
	for (const tagName of tagNames) {
		const pattern = new RegExp(
			`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`,
			"i",
		);
		const match = block.match(pattern);
		if (match) {
			return decodeXml(match[1]).trim();
		}
	}
	return "";
}

function extractAtomLink(block) {
	const links = [...block.matchAll(/<link\b([^>]*)>/gi)];
	for (const match of links) {
		const attrs = match[1] || "";
		const href = attrs.match(/\bhref=["']([^"']+)["']/i)?.[1] || "";
		if (!href) {
			continue;
		}
		const rel = attrs.match(/\brel=["']([^"']+)["']/i)?.[1] || "";
		if (!rel || rel === "alternate") {
			return decodeXml(href).trim();
		}
	}
	return "";
}

function normalizeUrl(value, baseUrl) {
	try {
		const url = new URL(decodeXml(value).trim(), baseUrl);
		if (!["http:", "https:"].includes(url.protocol)) {
			return "";
		}
		url.hash = "";
		return url.toString();
	} catch {
		return "";
	}
}

function normalizeDate(value) {
	const parsed = new Date(decodeXml(value).trim());
	if (Number.isNaN(parsed.getTime())) {
		return "";
	}
	return parsed.toISOString().slice(0, 10);
}

function parseRssItems(xml, source) {
	return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)]
		.map((match) => {
			const block = match[1] || "";
			return {
				title: cleanText(extractTag(block, ["title"]), 100),
				url: normalizeUrl(extractTag(block, ["link", "guid"]), source.feedurl),
				excerpt: cleanText(
					extractTag(block, ["description", "content:encoded", "summary"]),
					120,
				),
				date: normalizeDate(
					extractTag(block, ["pubDate", "dc:date", "updated", "published"]),
				),
			};
		})
		.filter((item) => item.title && item.url);
}

function parseAtomItems(xml, source) {
	return [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)]
		.map((match) => {
			const block = match[1] || "";
			return {
				title: cleanText(extractTag(block, ["title"]), 100),
				url: normalizeUrl(
					extractAtomLink(block) || extractTag(block, ["id"]),
					source.feedurl,
				),
				excerpt: cleanText(
					extractTag(block, ["summary", "content", "description"]),
					120,
				),
				date: normalizeDate(extractTag(block, ["updated", "published"])),
			};
		})
		.filter((item) => item.title && item.url);
}

export function parseFriendFeed(xml, source) {
	const text = String(xml || "").slice(0, MAX_FEED_BYTES);
	if (!/<(rss|feed)\b/i.test(text)) {
		return [];
	}
	const items = /<feed\b/i.test(text)
		? parseAtomItems(text, source)
		: parseRssItems(text, source);
	return items.map((item) => ({
		...item,
		friendTitle: source.title,
		friendDesc: source.desc,
		friendImgurl: source.imgurl,
		friendSiteurl: source.siteurl,
	}));
}

function normalizeManualPosts(source) {
	return Array.isArray(source.posts)
		? source.posts
				.filter((post) => post?.title && post?.url)
				.map((post) => ({
					title: String(post.title),
					url: normalizeUrl(post.url, source.siteurl),
					excerpt: cleanText(post.excerpt || "", 120),
					date: normalizeDate(post.date) || String(post.date || ""),
					friendTitle: source.title,
					friendDesc: source.desc,
					friendImgurl: source.imgurl,
					friendSiteurl: source.siteurl,
				}))
				.filter((post) => post.url)
		: [];
}

async function fetchWithTimeout(url) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);
	try {
		const response = await fetch(url, {
			headers: {
				accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
				"user-agent": "SayoriBlogFriendUpdates/1.0 (+https://blog.sayori.org/friends/)",
			},
			signal: controller.signal,
		});
		if (!response.ok) {
			return "";
		}
		return (await response.text()).slice(0, MAX_FEED_BYTES);
	} catch {
		return "";
	} finally {
		clearTimeout(timer);
	}
}

async function loadSourceUpdates(source) {
	if (!source.feedurl) {
		return normalizeManualPosts(source);
	}
	const xml = await fetchWithTimeout(source.feedurl);
	const liveUpdates = parseFriendFeed(xml, source).slice(0, 3);
	return liveUpdates.length ? liveUpdates : normalizeManualPosts(source);
}

function sortUpdates(updates) {
	return updates.sort((a, b) => {
		const dateCompare = String(b.date || "").localeCompare(String(a.date || ""));
		if (dateCompare !== 0) {
			return dateCompare;
		}
		return `${a.friendTitle}${a.title}`.localeCompare(`${b.friendTitle}${b.title}`);
	});
}

export async function loadFriendUpdates(limit = DEFAULT_LIMIT) {
	const updates = [];
	const byUrl = new Set();
	const sourceUpdates = await Promise.all(friendUpdateSources.map(loadSourceUpdates));
	for (const item of sourceUpdates.flat()) {
		if (byUrl.has(item.url)) {
			continue;
		}
		byUrl.add(item.url);
		updates.push(item);
	}
	return sortUpdates(updates).slice(0, limit);
}

export async function handleFriendUpdatesRequest(context) {
	const { request, waitUntil } = context;
	if (request.method === "OPTIONS") {
		return new Response(null, { status: 204 });
	}
	if (request.method !== "GET" && request.method !== "HEAD") {
		return errorResponse("Method not allowed", 405);
	}

	const requestUrl = new URL(request.url);
	const limit = clampLimit(requestUrl.searchParams.get("limit"));
	const cacheControl = request.headers.get("cache-control") || "";
	const bypassCache =
		requestUrl.searchParams.get("fresh") === "1" ||
		requestUrl.searchParams.get("refresh") === "1" ||
		/\bno-cache\b|\bno-store\b/i.test(cacheControl);
	const cache = globalThis.caches?.default;
	const cacheKey = cache
		? new Request(`https://blog.sayori.org/api/friend-updates-cache?limit=${limit}`)
		: null;
	const cached = !bypassCache && cacheKey ? await cache.match(cacheKey) : null;
	if (cached) {
		return cached;
	}

	const data = {
		success: true,
		updatedAt: new Date().toISOString(),
		updates: await loadFriendUpdates(limit),
	};
	const response = jsonResponse(data, request.method === "HEAD" ? 204 : 200, {
		"x-sayori-friend-updates-cache": "miss",
		...(bypassCache ? { "cache-control": "no-store" } : {}),
	});
	if (!bypassCache && cacheKey && request.method !== "HEAD") {
		const cacheResponse = jsonResponse(data, 200, {
			"x-sayori-friend-updates-cache": "hit",
		});
		waitUntil?.(cache.put(cacheKey, cacheResponse.clone()));
	}
	return response;
}
