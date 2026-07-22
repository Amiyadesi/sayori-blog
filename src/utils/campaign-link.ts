export const BLOG_ORIGIN = "https://blog.sayori.org";

export const CAMPAIGN_MEDIA = [
	"community",
	"video",
	"social",
	"repository",
	"referral",
	"feed",
	"email",
	"offline",
] as const;

export type CampaignMedium = (typeof CAMPAIGN_MEDIA)[number];

const CAMPAIGN_SOURCE_ALIASES = new Map([
	["linux.do", "linuxdo"],
	["linux-do", "linuxdo"],
	["linuxdo", "linuxdo"],
	["v2ex.com", "v2ex"],
	["v2ex", "v2ex"],
	["nodeloc.com", "nodeloc"],
	["nodeloc", "nodeloc"],
	["nodeseek.com", "nodeseek"],
	["nodeseek", "nodeseek"],
	["bilibili.com", "bilibili"],
	["b23.tv", "bilibili"],
	["bilibili", "bilibili"],
	["youtube.com", "youtube"],
	["youtu.be", "youtube"],
	["youtube", "youtube"],
	["github.com", "github"],
	["github", "github"],
]);

export interface CampaignLinkInput {
	target: string;
	source: string;
	medium: CampaignMedium | string;
	campaign: string;
	content?: string;
}

function normalizedInput(value: string): string {
	return String(value || "")
		.normalize("NFKC")
		.trim();
}

export function normalizeCampaignToken(value: string): string {
	return normalizedInput(value)
		.toLocaleLowerCase("en-US")
		.replace(/[\s_]+/gu, "-")
		.replace(/[^\p{L}\p{N}~-]+/gu, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 120);
}

function hostnameFromSource(value: string): string {
	const input = normalizedInput(value);
	if (!input) return "";

	const urlCandidate = /^https?:\/\//i.test(input)
		? input
		: /^(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(input)
			? `https://${input}`
			: "";
	if (!urlCandidate) return "";

	try {
		const url = new URL(urlCandidate);
		if (url.protocol !== "http:" && url.protocol !== "https:") return "";
		return url.hostname.toLocaleLowerCase("en-US").replace(/^www\./, "");
	} catch {
		return "";
	}
}

export function normalizeCampaignSource(value: string): string {
	const source = hostnameFromSource(value) || normalizeCampaignToken(value);
	return CAMPAIGN_SOURCE_ALIASES.get(source) || source;
}

function blogUrl(target: string): URL {
	let url: URL;
	try {
		url = new URL(normalizedInput(target), BLOG_ORIGIN);
	} catch {
		throw new Error("请输入有效的博客地址");
	}

	if (
		url.hostname.toLocaleLowerCase("en-US") !== "blog.sayori.org" ||
		(url.protocol !== "http:" && url.protocol !== "https:") ||
		url.port ||
		url.username ||
		url.password
	) {
		throw new Error("目标必须是 blog.sayori.org 的博客地址");
	}

	url.protocol = "https:";
	return url;
}

export function buildCampaignUrl(input: CampaignLinkInput): string {
	const url = blogUrl(input.target);
	const source = normalizeCampaignSource(input.source);
	const medium = normalizeCampaignToken(input.medium);
	const campaign = normalizeCampaignToken(input.campaign);
	const content = normalizeCampaignToken(input.content || "");

	if (!source) throw new Error("请填写推广来源");
	if (!CAMPAIGN_MEDIA.includes(medium as CampaignMedium)) {
		throw new Error("请选择有效的渠道类型");
	}
	if (!campaign) throw new Error("请填写 Campaign 名称");

	for (const key of [
		"utm_source",
		"utm_medium",
		"utm_campaign",
		"utm_content",
	]) {
		url.searchParams.delete(key);
	}
	url.searchParams.set("utm_source", source);
	url.searchParams.set("utm_medium", medium);
	url.searchParams.set("utm_campaign", campaign);
	if (content) url.searchParams.set("utm_content", content);

	return url.toString();
}

export function createDefaultCampaign(
	target: string,
	date = new Date(),
): string {
	let url: URL;
	try {
		url = new URL(normalizedInput(target), BLOG_ORIGIN);
	} catch {
		url = new URL(BLOG_ORIGIN);
	}
	const parts = url.pathname.split("/").filter(Boolean);
	let targetName = parts.at(-1) || "blog-home";
	try {
		targetName = decodeURIComponent(targetName);
	} catch {
		// Keep malformed input readable instead of blocking the form.
	}
	const year = String(date.getFullYear());
	const month = String(date.getMonth() + 1).padStart(2, "0");
	return `${year}${month}-${normalizeCampaignToken(targetName) || "blog-home"}`;
}

export function mergeRecentCampaignSources(
	existing: string[],
	next: string,
	limit = 20,
): string[] {
	const normalizedNext = normalizeCampaignSource(next);
	const normalizedExisting = existing
		.map(normalizeCampaignSource)
		.filter(Boolean);
	const sources = normalizedNext
		? [normalizedNext, ...normalizedExisting]
		: normalizedExisting;
	return [...new Set(sources)].slice(0, Math.max(1, limit));
}

export function removeRecentCampaignSource(
	existing: string[],
	source: string,
): string[] {
	const normalizedTarget = normalizeCampaignSource(source);
	return existing
		.map(normalizeCampaignSource)
		.filter((item) => item && item !== normalizedTarget);
}
