import { handleError, json, requireAdmin } from "../../_lib/admin.js";
import {
	hashValue,
	lookupIpInfo,
	normalizeIpInfoResponse,
} from "../../_lib/analytics.js";
import {
	forwardTwikoo,
	getTwikooAdminToken,
	readTwikooJson,
} from "../../_lib/twikoo.js";

const DEFAULT_PER_PAGE = 80;
const MAX_PER_PAGE = 100;
const MAX_PAGES = 5;
const QUESTION_PATTERN =
	/[?？]|(吗|怎么|如何|为什么|为啥|啥|什么|有没有|能不能|可不可以|是否|怎样|哪里|哪位|请问)/;
const EMPTY_IP_REVIEW = Object.freeze({
	present: false,
	maskedIp: "",
	countryCode: "",
	countryName: "",
	flag: "",
	region: "",
	city: "",
	asn: "",
	organization: "",
	isp: "",
	connectionType: "",
	isVpn: false,
	isProxy: false,
	isTor: false,
	isThreat: false,
	riskScore: 0,
	riskLevel: "unknown",
	riskLabels: [],
	riskSignalsKnown: false,
	source: "none",
});

function clampInteger(value, fallback, min, max) {
	const number = Number.parseInt(value, 10);
	if (!Number.isFinite(number)) return fallback;
	return Math.min(Math.max(number, min), max);
}

export function normalizeCommentQuery(url) {
	const search = url.searchParams;
	return {
		per: clampInteger(search.get("per"), DEFAULT_PER_PAGE, 1, MAX_PER_PAGE),
		pages: clampInteger(search.get("pages"), MAX_PAGES, 1, MAX_PAGES),
	};
}

function decodeEntities(value) {
	return value
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
}

function stripHtml(value) {
	return decodeEntities(
		String(value || "")
			.replace(/<br\s*\/?>/gi, "\n")
			.replace(/<[^>]+>/g, " ")
			.replace(/\s+/g, " ")
			.trim(),
	);
}

function normalizePath(value) {
	const raw = String(value || "").trim();
	if (!raw) return "";
	let pathname = raw;
	try {
		pathname = new URL(raw).pathname;
	} catch {
		pathname = raw.split("?")[0].split("#")[0];
	}
	if (!pathname.startsWith("/")) pathname = `/${pathname}`;
	return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export function canonicalCommentPath(value) {
	return normalizePath(value) || "未知页面";
}

function commentStatus(comment) {
	return comment.isSpam === true ? "hidden" : "visible";
}

function cleanString(value, maxLength) {
	return String(value || "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, maxLength);
}

function firstText(comment, keys) {
	for (const key of keys) {
		const value = key
			.split(".")
			.reduce((current, part) => current?.[part], comment);
		if (typeof value === "string" && value.trim()) {
			return value.trim();
		}
		if (typeof value === "number") {
			return String(value);
		}
	}
	return "";
}

export function getCommentIp(comment) {
	const value = firstText(comment, [
		"ip",
		"ipAddress",
		"clientIp",
		"remoteAddress",
		"headers.cf-connecting-ip",
		"headers.x-real-ip",
	]);
	if (!value) return "";
	const first = value.split(",")[0].trim();
	return /^[0-9a-fA-F:.]+$/.test(first) ? first.slice(0, 80) : "";
}

export function maskIp(ip) {
	const value = cleanString(ip, 80);
	if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
		const parts = value.split(".");
		return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
	}
	if (/^[0-9a-fA-F:]+$/.test(value) && value.includes(":")) {
		const parts = value.split(":").filter(Boolean);
		return [...parts.slice(0, 4), "xxxx", "xxxx", "xxxx", "xxxx"].join(":");
	}
	return "";
}

function flagFromCountry(countryCode) {
	const code = cleanString(countryCode, 2).toUpperCase();
	if (!/^[A-Z]{2}$/.test(code)) return "";
	try {
		return String.fromCodePoint(
			...code.split("").map((char) => 127397 + char.charCodeAt(0)),
		);
	} catch {
		return "";
	}
}

function boolValue(value) {
	return value === true || value === 1 || value === "1" || value === "true";
}

function normalizeCommentIpHints(comment) {
	const info = normalizeIpInfoResponse({
		location: {
			country: {
				code: firstText(comment, ["country", "countryCode", "country_code"]),
				name: firstText(comment, ["countryName", "country_name"]),
			},
			region: firstText(comment, ["region", "province"]),
			city: firstText(comment, ["city"]),
		},
		network: {
			asn: firstText(comment, ["asn", "AS"]),
			organization: firstText(comment, ["organization", "org"]),
			isp: firstText(comment, ["isp"]),
			type: firstText(comment, ["connectionType", "type"]),
		},
		security: {
			is_vpn: boolValue(comment.isVpn || comment.is_vpn || comment.vpn),
			is_proxy: boolValue(comment.isProxy || comment.is_proxy || comment.proxy),
			is_tor: boolValue(comment.isTor || comment.is_tor || comment.tor),
			is_threat: boolValue(comment.isThreat || comment.is_threat || comment.threat),
		},
	});
	return withRiskFields(info);
}

function withRiskFields(info) {
	const flags = {
		isVpn: Boolean(info.isVpn),
		isProxy: Boolean(info.isProxy),
		isTor: Boolean(info.isTor),
		isThreat: Boolean(info.isThreat),
	};
	if (info.riskSignalsKnown === false) {
		return {
			...info,
			...flags,
			flag: flagFromCountry(info.countryCode),
			riskScore: null,
			riskLevel: "unknown",
			riskLabels: [],
			riskSignalsKnown: false,
		};
	}
	let score = 0;
	if (flags.isThreat) score += 80;
	if (flags.isTor) score += 70;
	if (flags.isProxy) score += 45;
	if (flags.isVpn) score += 35;
	const networkText = `${info.connectionType || ""} ${info.organization || ""}`.toLowerCase();
	if (/(hosting|datacenter|data center|cloud|vps)/.test(networkText)) score += 15;
	score = Math.min(score, 100);
	const labels = [];
	if (flags.isVpn) labels.push("VPN");
	if (flags.isProxy) labels.push("Proxy");
	if (flags.isTor) labels.push("Tor");
	if (flags.isThreat) labels.push("Threat");
	if (info.connectionType) labels.push(info.connectionType);
	return {
		...info,
		flag: flagFromCountry(info.countryCode),
		riskScore: score,
		riskLevel:
			score >= 70 ? "high" : score >= 35 ? "medium" : score > 0 ? "low" : "normal",
		riskLabels: labels,
		riskSignalsKnown: true,
	};
}

export function buildIpReview(comment, enrichedInfo = null) {
	const ip = getCommentIp(comment);
	if (!ip) return { ...EMPTY_IP_REVIEW };
	const hinted = withRiskFields(enrichedInfo || normalizeCommentIpHints(comment));
	return {
		present: true,
		maskedIp: maskIp(ip),
		countryCode: cleanString(hinted.countryCode, 12),
		countryName: cleanString(hinted.countryName, 80),
		flag: cleanString(hinted.flag, 8),
		region: cleanString(hinted.region, 120),
		city: cleanString(hinted.city, 120),
		asn: cleanString(hinted.asn, 40),
		organization: cleanString(hinted.organization, 160),
		isp: cleanString(hinted.isp, 160),
		connectionType: cleanString(hinted.connectionType, 80),
		isVpn: Boolean(hinted.isVpn),
		isProxy: Boolean(hinted.isProxy),
		isTor: Boolean(hinted.isTor),
		isThreat: Boolean(hinted.isThreat),
		riskScore:
			hinted.riskSignalsKnown === false
				? null
				: Number(hinted.riskScore || 0),
		riskLevel: hinted.riskLevel || "normal",
		riskLabels: Array.isArray(hinted.riskLabels)
			? hinted.riskLabels.map((item) => cleanString(item, 40)).filter(Boolean)
			: [],
		riskSignalsKnown: hinted.riskSignalsKnown !== false,
		source: cleanString(hinted.source || (enrichedInfo ? "ipinfo" : "twikoo"), 32),
	};
}

export function sanitizeComment(comment, enrichedInfo = null) {
	const text = stripHtml(comment.commentText || comment.comment);
	const email = String(comment.mail || comment.email || "").trim().slice(0, 160);
	return {
		url: canonicalCommentPath(comment.url),
		nick: String(comment.nick || "匿名").slice(0, 80),
		email,
		commentText: text.slice(0, 500),
		created: Number(comment.created || 0),
		status: commentStatus(comment),
		isQuestion: QUESTION_PATTERN.test(text),
		ipReview: buildIpReview(comment, enrichedInfo),
	};
}

function sortByCreatedDesc(items) {
	return items.sort((a, b) => Number(b.created || 0) - Number(a.created || 0));
}

async function requestTwikooAdmin(env, payload) {
	const token = getTwikooAdminToken(env);
	if (!token) {
		throw json(
			{
				success: false,
				error: "Cloudflare 缺少 TWIKOO_ADMIN_PASSWORD，不能读取 Twikoo 评论统计",
			},
			{ status: 500 },
		);
	}
	const response = await forwardTwikoo(env, {
		...payload,
		accessToken: token,
	});
	const data = await readTwikooJson(response);
	if (!response.ok || !data || (data.code && data.code !== 0)) {
		throw json(
			{
				success: false,
				error: data?.message || `Twikoo 管理接口请求失败：${response.status}`,
			},
			{ status: 502 },
		);
	}
	return data;
}

async function enrichCommentIpReviews(env, comments) {
	if (!env.SAYORI_ANALYTICS_DB || !env.ANALYTICS_HASH_SECRET) {
		return comments.map((comment) => sanitizeComment(comment));
	}
	const enriched = [];
	for (const comment of comments) {
		const ip = getCommentIp(comment);
		if (!ip) {
			enriched.push(sanitizeComment(comment));
			continue;
		}
		try {
			const ipHash = await hashValue(env.ANALYTICS_HASH_SECRET, `ip:${ip}`);
			const info = await lookupIpInfo(env, ip, ipHash, Date.now(), null);
			enriched.push(sanitizeComment(comment, info));
		} catch {
			enriched.push(sanitizeComment(comment));
		}
	}
	return enriched;
}

async function loadAdminComments(env, query) {
	const firstPage = await requestTwikooAdmin(env, {
		event: "COMMENT_GET_FOR_ADMIN",
		per: query.per,
		page: 1,
	});
	const total = Number(firstPage.count || 0);
	const pageCount = Math.min(query.pages, Math.max(1, Math.ceil(total / query.per)));
	const remainingPages = [];
	for (let page = 2; page <= pageCount; page += 1) {
		remainingPages.push(
			requestTwikooAdmin(env, {
				event: "COMMENT_GET_FOR_ADMIN",
				per: query.per,
				page,
			}),
		);
	}
	const results = [firstPage, ...(await Promise.all(remainingPages))];
	const rawComments = results.flatMap((result) => result.data || []);
	return {
		total,
		comments: await enrichCommentIpReviews(env, rawComments),
	};
}

async function loadTypedCount(env, type) {
	const result = await requestTwikooAdmin(env, {
		event: "COMMENT_GET_FOR_ADMIN",
		per: 1,
		page: 1,
		type,
	});
	return Number(result.count || 0);
}

function summarizeTopPages(comments) {
	const pages = new Map();
	for (const comment of comments) {
		const current = pages.get(comment.url) || {
			url: comment.url,
			count: 0,
			questionCount: 0,
			latestCreated: 0,
		};
		current.count += 1;
		if (comment.isQuestion) current.questionCount += 1;
		current.latestCreated = Math.max(current.latestCreated, comment.created || 0);
		pages.set(comment.url, current);
	}
	return Array.from(pages.values())
		.sort((a, b) => b.count - a.count || b.latestCreated - a.latestCreated)
		.slice(0, 10);
}

export function buildCommentStats(total, visible, hidden, comments) {
	const sorted = sortByCreatedDesc([...comments]);
	const recentQuestions = sorted.filter((comment) => comment.isQuestion).slice(0, 10);
	const riskyComments = sorted
		.filter((comment) => comment.ipReview?.riskScore > 0 || comment.ipReview?.present)
		.sort((a, b) => (b.ipReview?.riskScore || 0) - (a.ipReview?.riskScore || 0) || b.created - a.created)
		.slice(0, 20);
	return {
		success: true,
		summary: {
			total,
			visible,
			hidden,
			loaded: comments.length,
			questionCount: comments.filter((comment) => comment.isQuestion).length,
			ipReviewed: comments.filter((comment) => comment.ipReview?.present).length,
			ipRisky: comments.filter((comment) => (comment.ipReview?.riskScore || 0) >= 35).length,
			sampled: comments.length < total,
		},
		topPages: summarizeTopPages(comments),
		recentQuestions,
		riskyComments,
		recentComments: sorted.slice(0, 20),
	};
}

export async function onRequestGet(context) {
	try {
		await requireAdmin(context.request, context.env);
		const query = normalizeCommentQuery(new URL(context.request.url));
		const [{ total, comments }, visible, hidden] = await Promise.all([
			loadAdminComments(context.env, query),
			loadTypedCount(context.env, "VISIBLE"),
			loadTypedCount(context.env, "HIDDEN"),
		]);
		return json(buildCommentStats(total, visible, hidden, comments));
	} catch (error) {
		return handleError(error);
	}
}
