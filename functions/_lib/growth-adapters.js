const DEFAULT_TIMEOUT_MS = 15_000;

function clipped(value, limit = 500) {
	return String(value || "").normalize("NFKC").trim().slice(0, limit);
}

function sourceResult(source, status, data = null, error = null, observedAt = Date.now()) {
	return {
		source,
		status,
		observedAt,
		data,
		error,
	};
}

function normalizedBaseUrl(value) {
	const url = new URL(clipped(value, 2048));
	if (url.protocol !== "https:" && url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
		throw new Error("Only HTTPS service URLs are allowed");
	}
	url.hash = "";
	url.search = "";
	return url.toString().replace(/\/+$/, "");
}

function endpoint(base, path) {
	return `${normalizedBaseUrl(base)}${path.startsWith("/") ? path : `/${path}`}`;
}

function errorForStatus(status) {
	if (status === 401 || status === 403) {
		return { code: "AUTH_FAILED", message: "上游鉴权失败", retryable: false };
	}
	if (status === 429) {
		return { code: "RATE_LIMITED", message: "上游额度或频率受限", retryable: true };
	}
	if (status >= 500) {
		return { code: "UPSTREAM_ERROR", message: "上游服务暂时失败", retryable: true };
	}
	return { code: "UPSTREAM_REJECTED", message: `上游拒绝请求，HTTP ${status}`, retryable: false };
}

function sanitizeException(error) {
	if (error?.name === "AbortError") {
		return { code: "TIMEOUT", message: "上游请求超时", retryable: true };
	}
	return { code: "NETWORK_ERROR", message: "无法连接上游服务", retryable: true };
}

async function fetchResponse(fetchImpl, url, init = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetchImpl(url, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(timeout);
	}
}

async function fetchJson(fetchImpl, url, init = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
	let response;
	try {
		response = await fetchResponse(fetchImpl, url, init, timeoutMs);
	} catch (error) {
		throw Object.assign(new Error("network"), { growthError: sanitizeException(error) });
	}
	if (!response.ok) {
		throw Object.assign(new Error("upstream"), { growthError: errorForStatus(response.status) });
	}
	try {
		return await response.json();
	} catch {
		throw Object.assign(new Error("invalid json"), {
			growthError: { code: "INVALID_RESPONSE", message: "上游返回了无效 JSON", retryable: true },
		});
	}
}

function caughtGrowthError(error) {
	return error?.growthError || sanitizeException(error);
}

function limitedList(value, limit = 10) {
	return Array.isArray(value) ? value.slice(0, limit) : [];
}

function invalidResponseError(message = "上游返回了不符合约定的数据") {
	return Object.assign(new Error("invalid response"), {
		growthError: { code: "INVALID_RESPONSE", message, retryable: true },
	});
}

function optionalCount(value) {
	if (value === null || value === undefined || value === "") return null;
	const number = Number(value);
	return Number.isFinite(number) && number >= 0 ? number : null;
}

function safeStringList(value, limit = 10, itemLimit = 300) {
	return limitedList(value, limit).map((item) => clipped(item, itemLimit)).filter(Boolean);
}

export async function runSearchGateway(input, env, fetchImpl = fetch) {
	if (!env.SEARCH_GATEWAY_BASE_URL || !env.SEARCH_GATEWAY_API_KEY) {
		return sourceResult("search_gateway", "not_configured", null, {
			code: "NOT_CONFIGURED",
			message: "Search Gateway 尚未配置",
			retryable: false,
		});
	}

	try {
		const data = await fetchJson(
			fetchImpl,
			endpoint(env.SEARCH_GATEWAY_BASE_URL, "/v1/evidence-search"),
			{
				method: "POST",
				headers: {
					accept: "application/json",
					"content-type": "application/json",
					authorization: `Bearer ${env.SEARCH_GATEWAY_API_KEY}`,
				},
				body: JSON.stringify({
					queries: input.queries,
					locale: input.locale || "zh-CN",
					providers: ["auto"],
					max_results: 8,
					filters: { include_domains: [], exclude_domains: [], freshness: null },
					budget: { max_provider_calls: 2, max_extract_pages: 3, timeout_ms: 12_000 },
					rerank: true,
				}),
			},
			16_000,
		);
		if (!data || typeof data !== "object" || !Array.isArray(data.results)) {
			throw invalidResponseError("Search Gateway 返回格式无效");
		}
		const results = limitedList(data.results, 10).map((item) => ({
			sourceId: clipped(item.source_id, 160),
			title: clipped(item.title, 300),
			url: clipped(item.canonical_url || item.url, 2048),
			domain: clipped(item.registrable_domain, 253),
			snippet: clipped(item.snippet, 700),
			matchedQueries: safeStringList(item.matched_queries, 3, 200),
			providers: safeStringList(item.providers, 3, 60),
		}));
		const providerRuns = limitedList(data.provider_runs, 12).map((run) => ({
			provider: clipped(run.provider, 80),
			query: clipped(run.query, 200),
			status: clipped(run.status, 40),
			latencyMs: Number(run.latency_ms || 0),
			resultCount: Number(run.result_count || 0),
			cacheHit: Boolean(run.cache_hit),
		}));
		const providerErrors = limitedList(data.errors, 8);
		return sourceResult(
			"search_gateway",
			data.partial || data.degraded || providerErrors.length ? "partial" : "complete",
			{
				queries: input.queries,
				results,
				providerRuns,
				usage: data.usage || {},
				limitations: safeStringList(data.limitations, 6, 400),
			},
			providerErrors.length
				? {
					code: "PARTIAL_PROVIDER_FAILURE",
					message: "部分搜索来源失败，已保留成功证据",
					retryable: true,
				}
				: null,
		);
	} catch (error) {
		return sourceResult("search_gateway", "error", null, caughtGrowthError(error));
	}
}

function parseSseEvents(value) {
	const events = [];
	for (const block of String(value || "").split(/\r?\n\r?\n/)) {
		if (!block.trim() || block.trimStart().startsWith(":")) continue;
		let event = "message";
		const dataLines = [];
		for (const line of block.split(/\r?\n/)) {
			if (line.startsWith("event:")) event = line.slice(6).trim();
			if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
		}
		if (!dataLines.length) continue;
		try {
			events.push({ event, data: JSON.parse(dataLines.join("\n")) });
		} catch {
			// Ignore incomplete heartbeat/proxy fragments.
		}
	}
	return events;
}

export async function runGeoScore(input, env, fetchImpl = fetch) {
	if (!env.GEOSCORE_API_URL || !env.GEOSCORE_ADMIN_TOKEN) {
		return sourceResult("geoscore", "not_configured", null, {
			code: "NOT_CONFIGURED",
			message: "GeoScore 管理接口尚未配置",
			retryable: false,
		});
	}

	try {
		const target = new URL(input.targetUrl);
		const url = new URL(
			endpoint(env.GEOSCORE_API_URL, `/api/audit/${encodeURIComponent(target.hostname)}`),
		);
		url.searchParams.set("mode", "url");
		url.searchParams.set("url", target.toString());
		if (input.fresh) url.searchParams.set("fresh", "1");
		const response = await fetchResponse(
			fetchImpl,
			url,
			{
				headers: {
					accept: "text/event-stream",
					authorization: `Bearer ${env.GEOSCORE_ADMIN_TOKEN}`,
				},
			},
			45_000,
		);
		if (!response.ok) {
			return sourceResult("geoscore", "error", null, errorForStatus(response.status));
		}
		const events = parseSseEvents(await response.text());
		const completion = [...events].reverse().find((item) => item.event === "complete");
		const failure = [...events].reverse().find((item) => item.event === "error");
		if (!completion?.data) {
			return sourceResult("geoscore", "error", null, {
				code: "INCOMPLETE_STREAM",
				message: clipped(failure?.data?.message, 300) || "GeoScore 未返回完整审计",
				retryable: true,
			});
		}
		const audit = completion.data;
		if (!audit || typeof audit !== "object" || Array.isArray(audit)) {
			throw invalidResponseError("GeoScore 完成事件格式无效");
		}
		const hasNormalizedChecks = Array.isArray(audit.normalized_checks);
		const hasLegacyChecks = Array.isArray(audit.checks);
		if (!hasNormalizedChecks && !hasLegacyChecks) {
			throw invalidResponseError("GeoScore 未返回事实检查项目");
		}
		const checks = hasNormalizedChecks
			? audit.normalized_checks
			: hasLegacyChecks
				? audit.checks
				: [];
		const failures = checks
			.filter((check) => check?.status === "fail" && check?.predicted !== true)
			.slice(0, 30)
			.map((check) => ({
				id: clipped(check.id, 160),
				title: clipped(check.localized_title?.zh || check.title, 300),
				severity: clipped(check.severity, 30),
				category: clipped(check.category, 20),
				pageUrl: clipped(check.page_url, 2048),
				source: clipped(check.source, 120),
				evidence: safeStringList(check.evidence, 8, 500),
				confidence: Number(check.confidence || 0),
			}));
		return sourceResult("geoscore", "complete", {
			auditId: clipped(audit.audit_id || audit.id, 160),
			scoreVersion: clipped(audit.score_version, 60),
			overallScore: audit.overall_score ?? audit.scores?.overall?.score ?? null,
			seoScore: audit.seo_score ?? audit.scores?.seo?.score ?? null,
			geoScore: audit.geo_score ?? audit.scores?.geo?.score ?? null,
			coverage: audit.scores?.overall?.coverage ?? audit.overall?.coverage ?? null,
			confidence: audit.scores?.overall?.confidence ?? audit.overall?.confidence ?? null,
			context: audit.audit_context || null,
			failures,
		});
	} catch (error) {
		return sourceResult("geoscore", "error", null, caughtGrowthError(error));
	}
}

function normalizedMetricRows(value) {
	return limitedList(value, 100)
		.map((row) => ({
			key: clipped(row.x ?? row.name ?? row.value ?? row.eventName, 500),
			value: optionalCount(row.y ?? row.count ?? row.visits ?? row.total),
		}))
		.filter((row) => row.key && row.value !== null);
}

function statsPageviews(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	return optionalCount(value.pageviews?.value ?? value.pageviews);
}

function addCampaignFilters(query, campaign) {
	for (const [camelKey, snakeKey, rawValue] of [
		["utmCampaign", "utm_campaign", campaign.name],
		["utmSource", "utm_source", campaign.source],
		["utmContent", "utm_content", campaign.content],
	]) {
		const value = clipped(rawValue, 120);
		if (!value) continue;
		query.set(camelKey, value);
		query.set(snakeKey, value);
	}
}

async function runUmamiCampaignMeasurement({ base, website, headers, query, path, campaign, fetchImpl }) {
	const filtered = new URLSearchParams(query);
	filtered.set("url", path);
	filtered.set("path", path);
	addCampaignFilters(filtered, campaign);
	const eventQuery = new URLSearchParams(filtered);
	eventQuery.set("type", "event");
	eventQuery.set("event", "effective_read");
	const calls = await Promise.all(
		[
			["landing", `${base}/websites/${website}/stats?${filtered}`],
			["effective_read", `${base}/websites/${website}/metrics?${eventQuery}`],
		].map(async ([name, url]) => {
			try {
				const data = await fetchJson(fetchImpl, url, { headers }, 12_000);
				if (name === "landing" && statsPageviews(data) === null) {
					throw invalidResponseError("Umami Campaign 落地数据格式无效");
				}
				if (name === "effective_read" && !Array.isArray(data)) {
					throw invalidResponseError("Umami Campaign 事件数据格式无效");
				}
				return [name, { ok: true, data }];
			} catch (error) {
				return [name, { ok: false, error: caughtGrowthError(error) }];
			}
		}),
	);
	const results = Object.fromEntries(calls);
	const eventRows = results.effective_read.ok
		? normalizedMetricRows(results.effective_read.data)
		: [];
	const effectiveRead = eventRows.find((row) => row.key === "effective_read");
	const successCount = Object.values(results).filter((result) => result.ok).length;
	const status = successCount === 2 ? "complete" : successCount === 1 ? "partial" : "error";
	const firstFailure = Object.values(results).find((result) => !result.ok)?.error;
	return {
		id: clipped(campaign.id, 180),
		name: clipped(campaign.name, 160),
		source: clipped(campaign.source, 120),
		content: clipped(campaign.content, 120),
		status,
		observedAt: Date.now(),
		landingVisits: results.landing.ok ? statsPageviews(results.landing.data) : null,
		effectiveReads: results.effective_read.ok ? (effectiveRead?.value ?? 0) : null,
		errorCode: firstFailure?.code || "",
	};
}

export async function runUmami(input, env, fetchImpl = fetch) {
	if (!env.UMAMI_API_URL || !env.UMAMI_API_TOKEN || !env.UMAMI_WEBSITE_ID) {
		return sourceResult("umami", "not_configured", null, {
			code: "NOT_CONFIGURED",
			message: "Umami 只读 API 尚未配置",
			retryable: false,
		});
	}
	const base = normalizedBaseUrl(env.UMAMI_API_URL);
	const website = encodeURIComponent(env.UMAMI_WEBSITE_ID);
	const path = new URL(input.targetUrl).pathname;
	const query = new URLSearchParams({
		startAt: String(input.startAt),
		endAt: String(input.endAt),
	});
	const targetQuery = new URLSearchParams(query);
	targetQuery.set("url", path);
	targetQuery.set("path", path);
	const headers = { accept: "application/json", authorization: `Bearer ${env.UMAMI_API_TOKEN}` };
	const calls = {
		stats: `${base}/websites/${website}/stats?${targetQuery}`,
		pages: `${base}/websites/${website}/metrics?${query}&type=url`,
		referrers: `${base}/websites/${website}/metrics?${targetQuery}&type=referrer`,
		events: `${base}/websites/${website}/metrics?${targetQuery}&type=event`,
		campaigns: `${base}/websites/${website}/metrics?${targetQuery}&type=utm_campaign`,
		sources: `${base}/websites/${website}/metrics?${targetQuery}&type=utm_source`,
	};
	const [entries, campaignMetrics] = await Promise.all([
		Promise.all(
			Object.entries(calls).map(async ([name, url]) => {
				try {
					const data = await fetchJson(fetchImpl, url, { headers }, 12_000);
					if (name === "stats") {
						if (!data || typeof data !== "object" || Array.isArray(data)) {
							throw invalidResponseError("Umami 统计数据格式无效");
						}
					} else if (!Array.isArray(data)) {
						throw invalidResponseError(`Umami ${name} 数据格式无效`);
					}
					return [name, { ok: true, data }];
				} catch (error) {
					return [name, { ok: false, error: caughtGrowthError(error) }];
				}
			}),
		),
		Promise.all(
			limitedList(input.campaigns, 12).map((campaign) =>
				runUmamiCampaignMeasurement({ base, website, headers, query, path, campaign, fetchImpl }),
			),
		),
	]);
	const results = Object.fromEntries(entries);
	const requiredFailures = ["stats", "pages", "events"].filter((name) => !results[name].ok);
	const hasCampaignEvidence = campaignMetrics.some(
		(item) => item.landingVisits !== null || item.effectiveReads !== null,
	);
	if (requiredFailures.length === 3 && !hasCampaignEvidence) {
		return sourceResult("umami", "error", null, results.stats.error);
	}
	const pages = results.pages.ok ? normalizedMetricRows(results.pages.data) : [];
	const events = results.events.ok ? normalizedMetricRows(results.events.data) : [];
	const pageRow = pages.find((row) => row.key === path || row.key === path.replace(/\/$/, ""));
	const effectiveReadRow = events.find((row) => row.key === "effective_read");
	const campaignFailures = campaignMetrics.filter((item) => item.status !== "complete");
	return sourceResult(
		"umami",
		requiredFailures.length || campaignFailures.length ? "partial" : "complete",
		{
			period: { startAt: input.startAt, endAt: input.endAt },
			stats: results.stats.ok ? results.stats.data : null,
			landingPageviews: pageRow?.value ?? null,
			effectiveReads: effectiveReadRow?.value ?? null,
			pages,
			referrers: results.referrers.ok ? normalizedMetricRows(results.referrers.data) : [],
			events,
			campaigns: results.campaigns.ok ? normalizedMetricRows(results.campaigns.data) : [],
			sources: results.sources.ok ? normalizedMetricRows(results.sources.data) : [],
			campaignMetrics,
			capabilities: Object.fromEntries(
				[
					...Object.entries(results).map(([name, result]) => [name, result.ok ? "complete" : "unavailable"]),
					[
						"campaignMetrics",
						campaignMetrics.length === 0
							? "not_applicable"
							: campaignFailures.length
								? "partial"
								: "complete",
					],
				],
			),
		},
		requiredFailures.length || campaignFailures.length
			? {
					code: campaignFailures.length ? "PARTIAL_CAMPAIGN_METRICS" : "PARTIAL_UMAMI_DATA",
					message: campaignFailures.length
						? "Umami 已保留成功数据，但部分 Campaign 指标不可用"
						: `Umami 缺少 ${requiredFailures.join(", ")} 数据`,
					retryable: true,
				}
			: null,
	);
}

function base64Url(value) {
	const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(value);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemBytes(pem) {
	const raw = String(pem || "")
		.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g, "");
	const binary = atob(raw);
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function serviceAccountAssertion(account, nowSeconds) {
	const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
	const payload = base64Url(
		JSON.stringify({
			iss: account.client_email,
			scope: "https://www.googleapis.com/auth/webmasters.readonly",
			aud: "https://oauth2.googleapis.com/token",
			iat: nowSeconds,
			exp: nowSeconds + 3600,
		}),
	);
	const unsigned = `${header}.${payload}`;
	const key = await crypto.subtle.importKey(
		"pkcs8",
		pemBytes(account.private_key),
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"RSASSA-PKCS1-v1_5",
		key,
		new TextEncoder().encode(unsigned),
	);
	return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}

function isoDate(timestamp) {
	return new Date(timestamp).toISOString().slice(0, 10);
}

export function buildGscWindows(now = Date.now()) {
	const endCurrent = new Date(now);
	endCurrent.setUTCHours(0, 0, 0, 0);
	endCurrent.setUTCDate(endCurrent.getUTCDate() - 3);
	const startCurrent = new Date(endCurrent);
	startCurrent.setUTCDate(startCurrent.getUTCDate() - 27);
	const endPrevious = new Date(startCurrent);
	endPrevious.setUTCDate(endPrevious.getUTCDate() - 1);
	const startPrevious = new Date(endPrevious);
	startPrevious.setUTCDate(startPrevious.getUTCDate() - 27);
	return {
		current: { startDate: isoDate(startCurrent), endDate: isoDate(endCurrent) },
		previous: { startDate: isoDate(startPrevious), endDate: isoDate(endPrevious) },
	};
}

function expectedCtr(position) {
	if (position <= 1) return 0.18;
	if (position <= 3) return 0.08;
	if (position <= 10) return 0.025;
	return 0.01;
}

export function normalizeGscRows(rows) {
	return limitedList(rows, 1000).map((row) => {
		const position = Number(row.position || 0);
		const ctr = Number(row.ctr || 0);
		const impressions = Number(row.impressions || 0);
		const reason =
			impressions < 20
				? "insufficient_evidence"
				: position >= 4 && position <= 20
					? "position"
					: ctr < expectedCtr(position) * 0.5
						? "low_ctr"
						: "none";
		return {
			query: clipped(row.keys?.[0], 300),
			page: clipped(row.keys?.[1], 2048),
			clicks: Number(row.clicks || 0),
			impressions,
			ctr,
			position,
			opportunity: reason === "position" || reason === "low_ctr",
			reason,
		};
	});
}

function gscResponseRows(data, label) {
	if (!data || typeof data !== "object" || Array.isArray(data)) {
		throw invalidResponseError(`Google Search Console ${label} 响应格式无效`);
	}
	if (data.rows === undefined) return [];
	if (!Array.isArray(data.rows)) {
		throw invalidResponseError(`Google Search Console ${label} rows 格式无效`);
	}
	return data.rows;
}

export async function runSearchConsole(input, env, fetchImpl = fetch) {
	if (!env.GSC_SERVICE_ACCOUNT_JSON) {
		return sourceResult("gsc", "not_configured", null, {
			code: "NOT_CONFIGURED",
			message: "Google Search Console 只读 Service Account 尚未配置",
			retryable: false,
		});
	}
	try {
		const account = JSON.parse(env.GSC_SERVICE_ACCOUNT_JSON);
		if (!account.client_email || !account.private_key) throw new Error("invalid account");
		const assertion = await serviceAccountAssertion(account, Math.floor(Date.now() / 1000));
		const token = await fetchJson(
			fetchImpl,
			"https://oauth2.googleapis.com/token",
			{
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
					assertion,
				}),
			},
			12_000,
		);
		if (!token.access_token) {
			throw Object.assign(new Error("missing token"), {
				growthError: { code: "INVALID_RESPONSE", message: "Google OAuth 未返回 access token", retryable: true },
			});
		}
		const property = env.GSC_PROPERTY || "sc-domain:sayori.org";
		const windows = buildGscWindows(input.now || Date.now());
		const targetUrl = new URL(input.targetUrl).toString();
		const reportUrl = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`;
		const queryWindow = async (window) =>
			fetchJson(
				fetchImpl,
				reportUrl,
				{
					method: "POST",
					headers: {
						accept: "application/json",
						"content-type": "application/json",
						authorization: `Bearer ${token.access_token}`,
					},
					body: JSON.stringify({
						...window,
						dimensions: ["query", "page"],
						dimensionFilterGroups: [
							{ filters: [{ dimension: "page", operator: "equals", expression: targetUrl }] },
						],
						rowLimit: 1000,
						dataState: "final",
					}),
				},
				15_000,
			);
		const [current, previous] = await Promise.all([
			queryWindow(windows.current),
			queryWindow(windows.previous),
		]);
		const currentRows = normalizeGscRows(gscResponseRows(current, "current"));
		return sourceResult("gsc", "complete", {
			property,
			windows,
			current: currentRows,
			previous: normalizeGscRows(gscResponseRows(previous, "previous")),
			opportunities: currentRows.filter((row) => row.opportunity),
		});
	} catch (error) {
		return sourceResult("gsc", "error", null, caughtGrowthError(error));
	}
}

export function defaultAnalysisPeriod(now = Date.now()) {
	const endAt = now - 3 * 86_400_000;
	return { startAt: endAt - 27 * 86_400_000, endAt };
}
