const ALLOWED_SITES = new Set(["blog", "home"]);
const ALLOWED_EVENTS = new Set(["pageview", "heartbeat"]);
const ALLOWED_RANGES = new Map([
	["1d", 24 * 60 * 60 * 1000],
	["7d", 7 * 24 * 60 * 60 * 1000],
	["30d", 30 * 24 * 60 * 60 * 1000],
]);

export const ONLINE_TTL_MS = 90 * 1000;
export const IP_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const EVENT_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const IP_LOOKUP_TIMEOUT_MS = 5000;
const IPSB_GEOIP_URL = "https://api.ip.sb/geoip/";

const BASE_CORS_HEADERS = {
	"access-control-allow-methods": "POST, OPTIONS",
	"access-control-allow-headers": "content-type",
	"access-control-max-age": "86400",
	"cache-control": "no-store",
	vary: "Origin",
};

const EMPTY_IP_INFO = Object.freeze({
	countryCode: "",
	countryName: "",
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
	riskSignalsKnown: false,
	source: "none",
});

const UNKNOWN_LOCATION_VALUES = new Set([
	"",
	"-",
	"--",
	"n/a",
	"na",
	"none",
	"null",
	"unknown",
	"undefined",
]);
const UNKNOWN_COUNTRY_CODES = new Set([
	"",
	"UN",
	"XX",
	"ZZ",
	"T1",
	"A1",
	"A2",
	"O1",
]);
const CHINA_REGION_NAMES = new Map([
	["AH", "安徽省"],
	["BJ", "北京市"],
	["CQ", "重庆市"],
	["FJ", "福建省"],
	["GD", "广东省"],
	["GS", "甘肃省"],
	["GX", "广西壮族自治区"],
	["GZ", "贵州省"],
	["HA", "河南省"],
	["HB", "湖北省"],
	["HE", "河北省"],
	["HI", "海南省"],
	["HK", "香港特别行政区"],
	["HL", "黑龙江省"],
	["HN", "湖南省"],
	["JL", "吉林省"],
	["JS", "江苏省"],
	["JX", "江西省"],
	["LN", "辽宁省"],
	["MO", "澳门特别行政区"],
	["NM", "内蒙古自治区"],
	["NX", "宁夏回族自治区"],
	["QH", "青海省"],
	["SC", "四川省"],
	["SD", "山东省"],
	["SH", "上海市"],
	["SN", "陕西省"],
	["SX", "山西省"],
	["TJ", "天津市"],
	["TW", "台湾省"],
	["XJ", "新疆维吾尔自治区"],
	["XZ", "西藏自治区"],
	["YN", "云南省"],
	["ZJ", "浙江省"],
]);
const CHINA_REGION_ALIASES = new Map([
	["anhui", "安徽省"],
	["beijing", "北京市"],
	["chongqing", "重庆市"],
	["fujian", "福建省"],
	["gansu", "甘肃省"],
	["guangdong", "广东省"],
	["guangxi", "广西壮族自治区"],
	["guizhou", "贵州省"],
	["hainan", "海南省"],
	["hebei", "河北省"],
	["heilongjiang", "黑龙江省"],
	["henan", "河南省"],
	["hubei", "湖北省"],
	["hunan", "湖南省"],
	["inner mongolia", "内蒙古自治区"],
	["jiangsu", "江苏省"],
	["jiangxi", "江西省"],
	["jilin", "吉林省"],
	["liaoning", "辽宁省"],
	["ningxia", "宁夏回族自治区"],
	["qinghai", "青海省"],
	["shaanxi", "陕西省"],
	["shandong", "山东省"],
	["shanghai", "上海市"],
	["shanxi", "山西省"],
	["sichuan", "四川省"],
	["tianjin", "天津市"],
	["tibet", "西藏自治区"],
	["xinjiang", "新疆维吾尔自治区"],
	["yunnan", "云南省"],
	["zhejiang", "浙江省"],
]);

function cleanString(value, maxLength) {
	return String(value || "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, maxLength);
}

function cleanLocationString(value, maxLength = 120) {
	const cleaned = cleanString(value, maxLength);
	return UNKNOWN_LOCATION_VALUES.has(cleaned.toLowerCase()) ? "" : cleaned;
}

function cleanNullableString(value, maxLength = 120) {
	const cleaned = cleanString(value, maxLength);
	return cleaned || null;
}

function cleanBool(value) {
	return value === true || value === 1 || value === "1" || value === "true";
}

function normalizeCountryCode(value) {
	const code = cleanLocationString(value, 12).toUpperCase();
	if (UNKNOWN_COUNTRY_CODES.has(code)) return "";
	return /^[A-Z]{2}$/.test(code) ? code : "";
}

function countryNameFromCode(code) {
	const normalized = normalizeCountryCode(code);
	if (!normalized) return "";
	try {
		return cleanString(
			new Intl.DisplayNames(["zh-CN"], { type: "region" }).of(
				normalized,
			),
			80,
		);
	} catch {
		return "";
	}
}

function normalizeCountryName(countryCode, countryName) {
	return (
		cleanLocationString(countryName, 80) || countryNameFromCode(countryCode)
	);
}

function adminCountryName(countryCode, countryName) {
	return (
		countryNameFromCode(countryCode) || cleanLocationString(countryName, 80)
	);
}

function countryNameInput(country, countryName) {
	if (typeof country === "object") {
		return country.name || countryName;
	}
	if (countryName) return countryName;
	return normalizeCountryCode(country) ? "" : country;
}

function normalizeRegionName(countryCode, region, regionCode = "") {
	const normalizedCountry = normalizeCountryCode(countryCode);
	const cleanRegion = cleanLocationString(region, 120);
	const cleanRegionCode = cleanLocationString(regionCode, 20).toUpperCase();
	if (normalizedCountry === "CN") {
		const normalizedRegionCode = cleanRegionCode
			.replace(/^CN-/, "")
			.trim();
		if (CHINA_REGION_NAMES.has(normalizedRegionCode)) {
			return CHINA_REGION_NAMES.get(normalizedRegionCode);
		}
		const byRegionCode = cleanRegion
			.toUpperCase()
			.replace(/^CN-/, "")
			.trim();
		if (CHINA_REGION_NAMES.has(byRegionCode)) {
			return CHINA_REGION_NAMES.get(byRegionCode);
		}
		const alias = cleanRegion.toLowerCase().replace(/\s+province$/i, "");
		if (CHINA_REGION_ALIASES.has(alias)) {
			return CHINA_REGION_ALIASES.get(alias);
		}
	}
	return cleanRegion || cleanRegionCode;
}

function normalizeCfIpInfo(cf = {}) {
	if (!cf || typeof cf !== "object") return EMPTY_IP_INFO;
	const countryCode = normalizeCountryCode(cf.country);
	const countryName = normalizeCountryName(countryCode, cf.countryName);
	return {
		...EMPTY_IP_INFO,
		countryCode,
		countryName,
		region: normalizeRegionName(countryCode, cf.region, cf.regionCode),
		city: cleanLocationString(cf.city, 120),
	};
}

function withDerivedLocation(info, cf) {
	const fallback = normalizeCfIpInfo(cf);
	const countryCode =
		normalizeCountryCode(info.countryCode) || fallback.countryCode;
	return {
		...EMPTY_IP_INFO,
		...info,
		countryCode,
		countryName:
			cleanLocationString(info.countryName, 80) ||
			fallback.countryName ||
			countryNameFromCode(countryCode),
		region:
			normalizeRegionName(countryCode, info.region) || fallback.region,
		city: cleanLocationString(info.city, 120) || fallback.city,
	};
}

function base64UrlEncode(bytes) {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

function expectedSiteFromUrl(url) {
	const hostname = url.hostname.toLowerCase();
	if (
		hostname === "blog.sayori.org" ||
		hostname === "sayori-blog.pages.dev" ||
		hostname.endsWith(".sayori-blog.pages.dev") ||
		hostname.endsWith("--sayori-blog.pages.dev")
	) {
		return "blog";
	}
	if (
		hostname === "sayori.org" ||
		hostname === "sayori-home.pages.dev" ||
		hostname.endsWith(".sayori-home.pages.dev") ||
		hostname.endsWith("--sayori-home.pages.dev")
	) {
		return "home";
	}
	return null;
}

function isLocalhost(url) {
	return (
		url.hostname === "localhost" ||
		url.hostname === "127.0.0.1" ||
		url.hostname === "::1"
	);
}

function isAllowedPagesPreview(url) {
	const hostname = url.hostname.toLowerCase();
	return (
		hostname === "sayori-blog.pages.dev" ||
		hostname === "sayori-home.pages.dev" ||
		hostname.endsWith(".sayori-blog.pages.dev") ||
		hostname.endsWith(".sayori-home.pages.dev") ||
		hostname.endsWith("--sayori-blog.pages.dev") ||
		hostname.endsWith("--sayori-home.pages.dev")
	);
}

export function isAllowedAnalyticsOrigin(origin) {
	if (!origin) return false;
	try {
		const url = new URL(origin);
		if (
			url.origin === "https://blog.sayori.org" ||
			url.origin === "https://sayori.org"
		) {
			return true;
		}
		if (isLocalhost(url)) {
			return url.protocol === "http:" || url.protocol === "https:";
		}
		return url.protocol === "https:" && isAllowedPagesPreview(url);
	} catch {
		return false;
	}
}

function isAllowedAnalyticsRequestSource(request) {
	const origin = request.headers.get("origin");
	if (origin) return isAllowedAnalyticsOrigin(origin);
	const referer = request.headers.get("referer");
	if (!referer) return false;
	try {
		return isAllowedAnalyticsOrigin(new URL(referer).origin);
	} catch {
		return false;
	}
}

export function corsHeadersForRequest(request) {
	const origin = request.headers.get("origin");
	const headers = new Headers(BASE_CORS_HEADERS);
	if (origin && isAllowedAnalyticsOrigin(origin)) {
		headers.set("access-control-allow-origin", origin);
	}
	return headers;
}

export function corsJson(request, data, init = {}) {
	const headers = corsHeadersForRequest(request);
	if (init.headers) {
		new Headers(init.headers).forEach((value, key) =>
			headers.set(key, value),
		);
	}
	headers.set("content-type", "application/json; charset=utf-8");
	return new Response(JSON.stringify(data), {
		status: init.status || 200,
		headers,
	});
}

export function handleAnalyticsError(request, error) {
	if (error instanceof Response) {
		return error;
	}
	console.error("[blog-analytics]", error);
	return corsJson(
		request,
		{ success: false, error: "analytics collector failed" },
		{ status: 500 },
	);
}

export function assertAllowedOrigin(request) {
	if (!isAllowedAnalyticsRequestSource(request)) {
		throw corsJson(
			request,
			{ success: false, error: "origin not allowed" },
			{ status: 403 },
		);
	}
}

export function getClientIp(request) {
	const cfIp = cleanString(request.headers.get("cf-connecting-ip"), 80);
	if (cfIp) return cfIp;
	const forwarded = cleanString(request.headers.get("x-forwarded-for"), 300);
	if (forwarded) {
		return cleanString(forwarded.split(",")[0], 80);
	}
	return "127.0.0.1";
}

function normalizePath(value, site) {
	const fallbackOrigin =
		site === "home" ? "https://sayori.org" : "https://blog.sayori.org";
	try {
		const url = new URL(String(value || "/"), fallbackOrigin);
		return cleanString(url.pathname || "/", 300) || "/";
	} catch {
		const path = cleanString(value, 300);
		return path.startsWith("/") ? path : "/";
	}
}

function normalizeSite(payload, request) {
	const value = cleanString(payload.site, 20).toLowerCase();
	if (ALLOWED_SITES.has(value)) return value;
	const origin = request.headers.get("origin");
	if (origin) {
		try {
			const expected = expectedSiteFromUrl(new URL(origin));
			if (expected) return expected;
		} catch {
			return null;
		}
	}
	try {
		return expectedSiteFromUrl(new URL(request.url));
	} catch {
		return null;
	}
}

function normalizeClientId(value) {
	const cleaned = cleanString(value, 120);
	if (/^[a-zA-Z0-9._:-]{12,120}$/.test(cleaned)) return cleaned;
	return crypto.randomUUID();
}

export function sanitizeAnalyticsPayload(payload, request) {
	const eventType = cleanString(payload.event, 20).toLowerCase();
	const site = normalizeSite(payload, request);
	if (!ALLOWED_EVENTS.has(eventType)) {
		throw corsJson(
			request,
			{ success: false, error: "invalid event" },
			{ status: 400 },
		);
	}
	if (!site) {
		throw corsJson(
			request,
			{ success: false, error: "invalid site" },
			{ status: 400 },
		);
	}

	return {
		eventType,
		site,
		visitorId: normalizeClientId(payload.visitorId),
		sessionId: normalizeClientId(payload.sessionId),
		path: normalizePath(payload.path || payload.href, site),
		title: cleanString(payload.title, 180),
	};
}

export async function hashValue(secret, value) {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(value),
	);
	return base64UrlEncode(new Uint8Array(signature));
}

function requireAnalyticsEnv(env) {
	if (!env.SAYORI_ANALYTICS_DB) {
		throw new Error("Cloudflare missing SAYORI_ANALYTICS_DB binding");
	}
	if (!env.ANALYTICS_HASH_SECRET) {
		throw new Error("Cloudflare missing ANALYTICS_HASH_SECRET secret");
	}
}

function rowToIpInfo(row) {
	if (!row) return null;
	return {
		countryCode: row.country_code || "",
		countryName: row.country_name || "",
		region: row.region || "",
		city: row.city || "",
		asn: row.asn || "",
		organization: row.organization || "",
		isp: row.isp || "",
		connectionType: row.connection_type || "",
		isVpn: Boolean(row.is_vpn),
		isProxy: Boolean(row.is_proxy),
		isTor: Boolean(row.is_tor),
		isThreat: Boolean(row.is_threat),
		riskSignalsKnown: Boolean(row.risk_signals_known),
		source: cleanString(row.provider || "cache", 32),
	};
}

function nestedValue(data, keys) {
	for (const key of keys) {
		const value = key
			.split(".")
			.reduce((current, part) => current?.[part], data);
		if (value !== undefined && value !== null && value !== "") return value;
	}
	return "";
}

export function normalizeIpInfoResponse(data) {
	const location = data?.location || data || {};
	const network = data?.network || data?.asn || {};
	const security = data?.security || data?.threat || {};
	const country = location.country || data?.country || {};
	const countryCode = normalizeCountryCode(
		typeof country === "object"
			? country.code || country.iso_code || data?.country_code
			: data?.country_code || country,
	);
	return {
		countryCode,
		countryName: normalizeCountryName(
			countryCode,
			countryNameInput(country, data?.country_name),
		),
		region: normalizeRegionName(
			countryCode,
			nestedValue({ location, data }, [
				"location.region.name",
				"location.region",
				"data.region",
			]),
			data?.region_code,
		),
		city: cleanLocationString(
			nestedValue({ location, data }, [
				"location.city.name",
				"location.city",
				"data.city",
			]),
			120,
		),
		asn: cleanString(network.asn || network.as || data?.asn || "", 40),
		organization: cleanString(
			network.organization || network.org || data?.organization || "",
			160,
		),
		isp: cleanString(
			network.isp ||
				data?.isp ||
				network.organization ||
				data?.organization ||
				"",
			160,
		),
		connectionType: cleanString(network.type || data?.type || "", 80),
		isVpn: cleanBool(security.is_vpn || security.vpn || data?.is_vpn),
		isProxy: cleanBool(
			security.is_proxy || security.proxy || data?.is_proxy,
		),
		isTor: cleanBool(security.is_tor || security.tor || data?.is_tor),
		isThreat: cleanBool(
			security.is_threat || security.threat || data?.is_threat,
		),
	};
}

async function readIpCache(db, ipHash) {
	const row = await db
		.prepare("SELECT * FROM analytics_ip_cache WHERE ip_hash = ?")
		.bind(ipHash)
		.first();
	return row || null;
}

async function writeIpCache(db, ipHash, info, now) {
	await db
		.prepare(
			`INSERT INTO analytics_ip_cache (
				ip_hash, country_code, country_name, region, city, asn, organization, isp,
				connection_type, is_vpn, is_proxy, is_tor, is_threat, provider,
				risk_signals_known, looked_up_at, expires_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(ip_hash) DO UPDATE SET
				country_code = excluded.country_code,
				country_name = excluded.country_name,
				region = excluded.region,
				city = excluded.city,
				asn = excluded.asn,
				organization = excluded.organization,
				isp = excluded.isp,
				connection_type = excluded.connection_type,
				is_vpn = excluded.is_vpn,
				is_proxy = excluded.is_proxy,
				is_tor = excluded.is_tor,
				is_threat = excluded.is_threat,
				provider = excluded.provider,
				risk_signals_known = excluded.risk_signals_known,
				looked_up_at = excluded.looked_up_at,
				expires_at = excluded.expires_at`,
		)
		.bind(
			ipHash,
			cleanNullableString(info.countryCode, 12),
			cleanNullableString(info.countryName, 80),
			cleanNullableString(info.region),
			cleanNullableString(info.city),
			cleanNullableString(info.asn, 40),
			cleanNullableString(info.organization, 160),
			cleanNullableString(info.isp, 160),
			cleanNullableString(info.connectionType, 80),
			info.isVpn ? 1 : 0,
			info.isProxy ? 1 : 0,
			info.isTor ? 1 : 0,
			info.isThreat ? 1 : 0,
			cleanString(info.source || "unknown", 32),
			info.riskSignalsKnown ? 1 : 0,
			now,
			now + IP_CACHE_TTL_MS,
		)
		.run();
}

function ipSbEnabled(env) {
	return String(env.IPSB_ENABLED || "").trim().toLowerCase() === "true";
}

function lookupSignal() {
	return AbortSignal.timeout(IP_LOOKUP_TIMEOUT_MS);
}

async function lookupDkly(env, ip) {
	if (!env.DKLY_IPINFO_API_KEY) return null;
	const url = new URL("https://ipinfo.dkly.net/api/");
	url.searchParams.set("ip", ip);
	const response = await fetch(url.toString(), {
		headers: {
			accept: "application/json",
			"X-API-Key": env.DKLY_IPINFO_API_KEY,
		},
		signal: lookupSignal(),
	});
	if (!response.ok) return null;
	const data = await response.json();
	if (!data || typeof data !== "object" || Array.isArray(data)) return null;
	return {
		...normalizeIpInfoResponse(data),
		riskSignalsKnown: true,
		source: "dkly",
	};
}

async function lookupIpSb(env, ip) {
	if (!ipSbEnabled(env)) return null;
	const response = await fetch(`${IPSB_GEOIP_URL}${encodeURIComponent(ip)}`, {
		headers: {
			accept: "application/json",
			"user-agent": "sayori-blog/1.0 (+https://blog.sayori.org)",
		},
		signal: lookupSignal(),
	});
	if (!response.ok) return null;
	const data = await response.json();
	if (!data || typeof data !== "object" || Array.isArray(data)) return null;
	const asn = cleanString(data.asn, 40);
	const normalized = normalizeIpInfoResponse({
		...data,
		country_name: data.country,
		asn: asn && !asn.toUpperCase().startsWith("AS") ? `AS${asn}` : asn,
		organization: data.asn_organization || data.organization,
	});
	return {
		...normalized,
		riskSignalsKnown: false,
		source: "ipsb",
	};
}

export async function lookupIpInfo(
	env,
	ip,
	ipHash,
	now = Date.now(),
	cf = null,
) {
	const db = env.SAYORI_ANALYTICS_DB;
	const cached = await readIpCache(db, ipHash);
	if (cached && Number(cached.expires_at) > now) {
		return withDerivedLocation(rowToIpInfo(cached), cf);
	}
	for (const [name, provider] of [
		["dkly", () => lookupDkly(env, ip)],
		["ipsb", () => lookupIpSb(env, ip)],
	]) {
		try {
			const result = await provider();
			if (!result) continue;
			const info = withDerivedLocation(result, cf);
			await writeIpCache(db, ipHash, info, now);
			return info;
		} catch (error) {
			console.warn(
				`[blog-analytics] ${name} IP lookup failed`,
				error?.name || "Error",
			);
		}
	}

	return withDerivedLocation(EMPTY_IP_INFO, cf);
}

function ipInfoBindValues(info) {
	return [
		cleanNullableString(info.countryCode, 12),
		cleanNullableString(info.countryName, 80),
		cleanNullableString(info.region),
		cleanNullableString(info.city),
		cleanNullableString(info.asn, 40),
		cleanNullableString(info.organization, 160),
		cleanNullableString(info.isp, 160),
		cleanNullableString(info.connectionType, 80),
		info.isVpn ? 1 : 0,
		info.isProxy ? 1 : 0,
		info.isTor ? 1 : 0,
		info.isThreat ? 1 : 0,
		info.riskSignalsKnown ? 1 : 0,
	];
}

export async function recordAnalyticsEvent(context) {
	const { env, request } = context;
	requireAnalyticsEnv(env);
	assertAllowedOrigin(request);

	const payload = await request.json().catch(() => ({}));
	const event = sanitizeAnalyticsPayload(payload, request);
	const now = Date.now();
	const ip = getClientIp(request);
	const visitorHash = await hashValue(
		env.ANALYTICS_HASH_SECRET,
		`visitor:${event.site}:${event.visitorId}`,
	);
	const sessionHash = await hashValue(
		env.ANALYTICS_HASH_SECRET,
		`session:${event.site}:${event.sessionId}`,
	);
	const ipHash = await hashValue(env.ANALYTICS_HASH_SECRET, `ip:${ip}`);
	const ipInfo = await lookupIpInfo(env, ip, ipHash, now, request.cf);
	const ipValues = ipInfoBindValues(ipInfo);
	const pageviewIncrement = event.eventType === "pageview" ? 1 : 0;
	const heartbeatIncrement = event.eventType === "heartbeat" ? 1 : 0;

	await env.SAYORI_ANALYTICS_DB.prepare(
		`INSERT INTO analytics_events (
				id, site, event_type, visitor_hash, session_hash, ip_hash, path, title,
				country_code, country_name, region, city, asn, organization, isp,
				connection_type, is_vpn, is_proxy, is_tor, is_threat,
				risk_signals_known, created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	)
		.bind(
			crypto.randomUUID(),
			event.site,
			event.eventType,
			visitorHash,
			sessionHash,
			ipHash,
			event.path,
			event.title,
			...ipValues,
			now,
		)
		.run();

	await env.SAYORI_ANALYTICS_DB.prepare(
		`INSERT INTO analytics_sessions (
				session_hash, visitor_hash, ip_hash, site, first_seen_at, last_seen_at,
				last_event_type, current_path, current_title, pageviews, heartbeats,
				country_code, country_name, region, city, asn, organization, isp,
				connection_type, is_vpn, is_proxy, is_tor, is_threat, risk_signals_known
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(session_hash) DO UPDATE SET
				visitor_hash = excluded.visitor_hash,
				ip_hash = excluded.ip_hash,
				site = excluded.site,
				last_seen_at = excluded.last_seen_at,
				last_event_type = excluded.last_event_type,
				current_path = excluded.current_path,
				current_title = excluded.current_title,
				pageviews = pageviews + ?,
				heartbeats = heartbeats + ?,
				country_code = excluded.country_code,
				country_name = excluded.country_name,
				region = excluded.region,
				city = excluded.city,
				asn = excluded.asn,
				organization = excluded.organization,
				isp = excluded.isp,
				connection_type = excluded.connection_type,
				is_vpn = excluded.is_vpn,
				is_proxy = excluded.is_proxy,
				is_tor = excluded.is_tor,
				is_threat = excluded.is_threat,
				risk_signals_known = excluded.risk_signals_known`,
	)
		.bind(
			sessionHash,
			visitorHash,
			ipHash,
			event.site,
			now,
			now,
			event.eventType,
			event.path,
			event.title,
			pageviewIncrement,
			heartbeatIncrement,
			...ipValues,
			pageviewIncrement,
			heartbeatIncrement,
		)
		.run();

	if (event.eventType === "pageview" && Math.random() < 0.02) {
		await pruneOldAnalytics(env.SAYORI_ANALYTICS_DB, now);
	}

	return {
		success: true,
		onlineTtlSeconds: ONLINE_TTL_MS / 1000,
	};
}

async function pruneOldAnalytics(db, now) {
	const cutoff = now - EVENT_RETENTION_MS;
	await db
		.prepare("DELETE FROM analytics_events WHERE created_at < ?")
		.bind(cutoff)
		.run();
	await db
		.prepare("DELETE FROM analytics_sessions WHERE last_seen_at < ?")
		.bind(cutoff)
		.run();
	await db
		.prepare("DELETE FROM analytics_ip_cache WHERE expires_at < ?")
		.bind(now)
		.run();
}

function buildSiteClause(site, tableAlias = "") {
	if (site === "all") return { sql: "", params: [] };
	const prefix = tableAlias ? `${tableAlias}.` : "";
	return { sql: ` AND ${prefix}site = ?`, params: [site] };
}

function numberField(row, key) {
	return Number(row?.[key] || 0);
}

function mapSecurity(row) {
	return {
		isVpn: Boolean(row.is_vpn),
		isProxy: Boolean(row.is_proxy),
		isTor: Boolean(row.is_tor),
		isThreat: Boolean(row.is_threat),
		riskSignalsKnown: Boolean(row.risk_signals_known),
	};
}

function locationScope(countryCode) {
	const code = normalizeCountryCode(countryCode);
	if (!code) return "unknown";
	if (code === "CN" || code === "HK" || code === "MO" || code === "TW") {
		return "domestic";
	}
	return "foreign";
}

function mapPlace(row) {
	const countryCode = normalizeCountryCode(row.country_code);
	return {
		locationScope: locationScope(countryCode),
		countryCode,
		countryName: adminCountryName(countryCode, row.country_name),
		region: normalizeRegionName(countryCode, row.region),
		city: cleanLocationString(row.city),
		isp: row.isp || row.organization || "",
		organization: row.organization || "",
		asn: row.asn || "",
		connectionType: row.connection_type || "",
		...mapSecurity(row),
	};
}

export function normalizeAnalyticsQuery(url) {
	const site = cleanString(
		url.searchParams.get("site") || "all",
		20,
	).toLowerCase();
	const range = cleanString(
		url.searchParams.get("range") || "7d",
		20,
	).toLowerCase();
	return {
		site: site === "all" || ALLOWED_SITES.has(site) ? site : "all",
		range: ALLOWED_RANGES.has(range) ? range : "7d",
	};
}

export async function getAdminAnalytics(env, options = {}) {
	if (!env.SAYORI_ANALYTICS_DB) {
		throw new Error("Cloudflare missing SAYORI_ANALYTICS_DB binding");
	}
	const db = env.SAYORI_ANALYTICS_DB;
	const site = options.site || "all";
	const range = options.range || "7d";
	const now = Date.now();
	const start = now - (ALLOWED_RANGES.get(range) || ALLOWED_RANGES.get("7d"));
	const eventSite = buildSiteClause(site);
	const sessionSite = buildSiteClause(site);

	const summary = await db
		.prepare(
			`SELECT
				COUNT(CASE WHEN event_type = 'pageview' THEN 1 END) AS pageviews,
				COUNT(CASE WHEN event_type = 'heartbeat' THEN 1 END) AS heartbeats,
				COUNT(DISTINCT visitor_hash) AS visitors,
				COUNT(DISTINCT session_hash) AS sessions
			FROM analytics_events
			WHERE created_at >= ?${eventSite.sql}`,
		)
		.bind(start, ...eventSite.params)
		.first();

	const onlineSummary = await db
		.prepare(
			`SELECT COUNT(*) AS online
			FROM analytics_sessions
			WHERE last_seen_at >= ?${sessionSite.sql}`,
		)
		.bind(now - ONLINE_TTL_MS, ...sessionSite.params)
		.first();

	const bySite = await db
		.prepare(
			`SELECT site, COUNT(*) AS events,
				COUNT(CASE WHEN event_type = 'pageview' THEN 1 END) AS pageviews,
				COUNT(DISTINCT visitor_hash) AS visitors
			FROM analytics_events
			WHERE created_at >= ?${eventSite.sql}
			GROUP BY site
			ORDER BY pageviews DESC`,
		)
		.bind(start, ...eventSite.params)
		.all();

	const topPages = await db
		.prepare(
			`SELECT site, path, COALESCE(NULLIF(title, ''), path) AS title,
				COUNT(*) AS pageviews,
				COUNT(DISTINCT visitor_hash) AS visitors,
				MAX(created_at) AS last_seen_at
			FROM analytics_events
			WHERE created_at >= ? AND event_type = 'pageview'${eventSite.sql}
			GROUP BY site, path, title
			ORDER BY pageviews DESC, last_seen_at DESC
			LIMIT 12`,
		)
		.bind(start, ...eventSite.params)
		.all();

	const online = await db
		.prepare(
			`SELECT site, current_path AS path, current_title AS title, last_seen_at,
				pageviews, heartbeats, country_code, country_name, region, city, asn,
				organization, isp, connection_type, is_vpn, is_proxy, is_tor, is_threat,
				risk_signals_known
			FROM analytics_sessions
			WHERE last_seen_at >= ?${sessionSite.sql}
			ORDER BY last_seen_at DESC
			LIMIT 30`,
		)
		.bind(now - ONLINE_TTL_MS, ...sessionSite.params)
		.all();

	const recentEvents = await db
		.prepare(
			`SELECT site, event_type, path, title, created_at, country_code, country_name,
				region, city, asn, organization, isp, connection_type,
				is_vpn, is_proxy, is_tor, is_threat, risk_signals_known
			FROM analytics_events
			WHERE created_at >= ?${eventSite.sql}
			ORDER BY created_at DESC
			LIMIT 30`,
		)
		.bind(start, ...eventSite.params)
		.all();

	const countries = await db
		.prepare(
			`SELECT COALESCE(NULLIF(country_code, ''), 'UN') AS country_code,
				COALESCE(NULLIF(country_name, ''), '') AS country_name,
				COUNT(*) AS pageviews,
				COUNT(DISTINCT visitor_hash) AS visitors
			FROM analytics_events
			WHERE created_at >= ? AND event_type = 'pageview'${eventSite.sql}
			GROUP BY country_code, country_name
			ORDER BY pageviews DESC
			LIMIT 12`,
		)
		.bind(start, ...eventSite.params)
		.all();

	const cities = await db
		.prepare(
			`SELECT COALESCE(NULLIF(country_code, ''), 'UN') AS country_code,
				COALESCE(NULLIF(country_name, ''), '') AS country_name,
				COALESCE(NULLIF(region, ''), '') AS region,
				COALESCE(NULLIF(city, ''), '') AS city,
				COUNT(*) AS pageviews
			FROM analytics_events
			WHERE created_at >= ? AND event_type = 'pageview'${eventSite.sql}
			GROUP BY country_code, country_name, region, city
			ORDER BY pageviews DESC
			LIMIT 12`,
		)
		.bind(start, ...eventSite.params)
		.all();

	const isps = await db
		.prepare(
			`SELECT COALESCE(NULLIF(isp, ''), NULLIF(organization, ''), 'Unknown') AS isp,
				COUNT(*) AS pageviews,
				COUNT(DISTINCT visitor_hash) AS visitors
			FROM analytics_events
			WHERE created_at >= ? AND event_type = 'pageview'${eventSite.sql}
			GROUP BY isp
			ORDER BY pageviews DESC
			LIMIT 12`,
		)
		.bind(start, ...eventSite.params)
		.all();

	const security = await db
		.prepare(
			`SELECT
				SUM(CASE WHEN is_vpn = 1 THEN 1 ELSE 0 END) AS vpn,
				SUM(CASE WHEN is_proxy = 1 THEN 1 ELSE 0 END) AS proxy,
				SUM(CASE WHEN is_tor = 1 THEN 1 ELSE 0 END) AS tor,
				SUM(CASE WHEN is_threat = 1 THEN 1 ELSE 0 END) AS threat
			FROM analytics_events
			WHERE created_at >= ? AND event_type = 'pageview'${eventSite.sql}`,
		)
		.bind(start, ...eventSite.params)
		.first();

	return {
		success: true,
		query: { site, range, generatedAt: now },
		summary: {
			pageviews: numberField(summary, "pageviews"),
			heartbeats: numberField(summary, "heartbeats"),
			visitors: numberField(summary, "visitors"),
			sessions: numberField(summary, "sessions"),
			online: numberField(onlineSummary, "online"),
			bySite: (bySite.results || []).map((row) => ({
				site: row.site,
				events: numberField(row, "events"),
				pageviews: numberField(row, "pageviews"),
				visitors: numberField(row, "visitors"),
			})),
		},
		online: (online.results || []).map((row) => ({
			site: row.site,
			path: row.path,
			title: row.title || row.path,
			lastSeenAt: numberField(row, "last_seen_at"),
			pageviews: numberField(row, "pageviews"),
			heartbeats: numberField(row, "heartbeats"),
			...mapPlace(row),
		})),
		topPages: (topPages.results || []).map((row) => ({
			site: row.site,
			path: row.path,
			title: row.title || row.path,
			pageviews: numberField(row, "pageviews"),
			visitors: numberField(row, "visitors"),
			lastSeenAt: numberField(row, "last_seen_at"),
		})),
		recentEvents: (recentEvents.results || []).map((row) => ({
			site: row.site,
			eventType: row.event_type,
			path: row.path,
			title: row.title || row.path,
			createdAt: numberField(row, "created_at"),
			...mapPlace(row),
		})),
		geoBreakdown: {
			countries: (countries.results || []).map((row) => ({
				locationScope: locationScope(row.country_code),
				countryCode: normalizeCountryCode(row.country_code),
				countryName: adminCountryName(
					row.country_code,
					row.country_name,
				),
				pageviews: numberField(row, "pageviews"),
				visitors: numberField(row, "visitors"),
			})),
			cities: (cities.results || []).map((row) => ({
				locationScope: locationScope(row.country_code),
				countryCode: normalizeCountryCode(row.country_code),
				countryName: adminCountryName(
					row.country_code,
					row.country_name,
				),
				region: normalizeRegionName(row.country_code, row.region),
				city: cleanLocationString(row.city),
				pageviews: numberField(row, "pageviews"),
			})),
		},
		ispBreakdown: (isps.results || []).map((row) => ({
			isp: row.isp,
			pageviews: numberField(row, "pageviews"),
			visitors: numberField(row, "visitors"),
		})),
		securityBreakdown: {
			vpn: numberField(security, "vpn"),
			proxy: numberField(security, "proxy"),
			tor: numberField(security, "tor"),
			threat: numberField(security, "threat"),
		},
	};
}
