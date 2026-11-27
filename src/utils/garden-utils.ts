import type { CollectionEntry } from "astro:content";
import { gardenLinkEdges } from "../generated/garden-graph";
import { getPostActivityDate, getPostDisplayTags, isOrdinaryPublicPost } from "./content-utils";
import { getPostPublicDescription } from "./post-card-content";
import { isEnglishSite, isExtraLocale, isTraditionalSite } from "./site-locale";
import { getPostUrl, removeFileExtension, url } from "./url-utils";

export type GardenStage = "seedling" | "budding" | "evergreen";

export interface GardenTopicDefinition {
	id: string;
	icon: string;
	accent: string;
	title: {
		zh: string;
		hant: string;
		en: string;
	};
	subtitle: {
		zh: string;
		hant: string;
		en: string;
	};
	hubSlug?: string;
}

export interface GardenBacklinkItem {
	slug: string;
	title: string;
	url: string;
	stage: GardenStage;
	topicId: string;
	snippet: string;
}

export interface GardenOutboundItem {
	slug: string;
	title: string;
	url: string;
	stage: GardenStage;
	topicId: string;
}

export interface GardenNodeMeta {
	slug: string;
	postId: string;
	title: string;
	description: string;
	url: string;
	topicId: string;
	stage: GardenStage;
	isGardenCore: boolean;
	archived: boolean;
	archivedReason: string;
	published: Date;
	lastTended: Date;
	updateCount: number;
	tags: string[];
	outbound: GardenOutboundItem[];
	backlinks: GardenBacklinkItem[];
	degree: number;
}

export const GARDEN_TOPICS: GardenTopicDefinition[] = [
	{
		id: "server-selfhost",
		icon: "🖥",
		accent: "#3b7a57",
		hubSlug: "student-2c2g-server-service-index/2c2g-server-service-index",
		title: {
			zh: "数字基地与 2C2G 自托管",
			hant: "數位基地與 2C2G 自託管",
			en: "Digital Base & 2C2G Self-Hosting",
		},
		subtitle: {
			zh: "从零搭博客、免费域名、Cloudflare 免费层，到 2C2G 学生服务器、Docker 与家里云",
			hant: "從零搭部落格、免費網域、Cloudflare 免費層，到 2C2G 學生伺服器、Docker 與家裡雲",
			en: "Building a blog from scratch, free domains, Cloudflare free tier, 2C2G VPS, Docker, and home servers",
		},
	},
	{
		id: "godot-gamedev",
		icon: "🎮",
		accent: "#4a6fa5",
		hubSlug: "godot-development-notes",
		title: {
			zh: "独立游戏与 Godot 开发",
			hant: "獨立遊戲與 Godot 開發",
			en: "Indie Games & Godot Development",
		},
		subtitle: {
			zh: "Godot 开发习惯、常用插件、Steam 发行避坑，以及 Game Jam 与开发复盘",
			hant: "Godot 開發習慣、常用外掛、Steam 發行避坑，以及 Game Jam 與開發復盤",
			en: "Godot development habits, useful plugins, Steam publishing guide, and Game Jam postmortems",
		},
	},
	{
		id: "ai-student-dev",
		icon: "🤖",
		accent: "#7b5ea7",
		hubSlug: "edumails-glados-student-benefits",
		title: {
			zh: "AI 工作流与学生开发权益",
			hant: "AI 工作流與學生開發權益",
			en: "AI Workflows & Student Developer Perks",
		},
		subtitle: {
			zh: "自建搜索网关、GeoScore 审计、官方教育邮箱权益、云额度与多模型开发环境",
			hant: "自建搜尋閘道、GeoScore 審計、官方教育信箱權益、雲端額度與多模型開發環境",
			en: "Self-hosted search gateway, GeoScore auditing, student developer packs, cloud credits, and AI tooling",
		},
	},
	{
		id: "fitness-health",
		icon: "🏃",
		accent: "#c96a3b",
		hubSlug: "beginner-fitness-01",
		title: {
			zh: "新手锻炼与健康生活",
			hant: "新手鍛鍊與健康生活",
			en: "Beginner Fitness & Healthy Living",
		},
		subtitle: {
			zh: "从半年减重 50 斤的亲历出发：运动误区、有氧运动、力量训练与食堂健康饮食",
			hant: "從半年減重 50 斤的親歷出發：運動誤區、有氧運動、力量訓練與食堂健康飲食",
			en: "From losing 25 kg in half a year to practical guides on cardio, strength training, and everyday nutrition",
		},
	},
	{
		id: "toolbox-community",
		icon: "🧰",
		accent: "#2d8a8a",
		hubSlug: "site-article-index",
		title: {
			zh: "工具箱、开源服务与社区图谱",
			hant: "工具箱、開源服務與社群圖譜",
			en: "Toolboxes, Open Services & Communities",
		},
		subtitle: {
			zh: "全站导航、常用免费软件与浏览器扩展、站长资源、公益开源服务及中文社区漫游",
			hant: "全站導覽、常用免費軟體與瀏覽器擴充、站長資源、公益開源服務及中文社群漫遊",
			en: "Site index, free software and browser extension toolboxes, public open-source services, and web communities",
		},
	},
	{
		id: "creator-mindset",
		icon: "✒️",
		accent: "#8c586a",
		hubSlug: "creaters-confidence-circle",
		title: {
			zh: "创作者自省与深度阅读",
			hant: "創作者自省與深度閱讀",
			en: "Creator Reflections & Deep Reading",
		},
		subtitle: {
			zh: "独立博客问答、创作者自信心循环、创作与大学生活的平衡，以及每周互联网精读",
			hant: "獨立部落格問答、創作者自信心循環、創作與大學生活的平衡，以及每週網路精讀",
			en: "Blogging self-checks, creator confidence loops, balancing creation with university life, and weekly reading notes",
		},
	},
	{
		id: "rationality-privacy",
		icon: "🔍",
		accent: "#5b6e8c",
		hubSlug: "from-90-to-667",
		title: {
			zh: "理性思辨、隐私与外部观察",
			hant: "理性思辨、隱私與外部觀察",
			en: "Rationality, Privacy & Observations",
		},
		subtitle: {
			zh: "理性与感性的边界、用价值衡量一切的反思、大学众生相，以及数字足迹与移动隐私",
			hant: "理性與感性的邊界、用價值衡量一切的反思、大學眾生相，以及數位足跡與行動隱私",
			en: "Boundaries of rationality, measuring value, university portraits, digital footprints, and mobile privacy",
		},
	},
	{
		id: "growth-footprints",
		icon: "🌱",
		accent: "#6b7d47",
		hubSlug: "ziwojieshao/self-introduction",
		title: {
			zh: "成长档案与三次元足迹",
			hant: "成長檔案與三次元足跡",
			en: "Growth Archives & Life Footprints",
		},
		subtitle: {
			zh: "从 18 岁前到 19 岁的阶段档案、自我介绍、香港开卡旅行与建站沿革",
			hant: "從 18 歲前到 19 歲的階段檔案、自我介紹、香港開卡旅行與建站沿革",
			en: "Milestones from before 18 to 19, self-introductions, first trip to Hong Kong, and blog evolution",
		},
	},
];

// Explicit topic assignment map by canonical garden slug
const SLUG_TOPIC_MAP: Record<string, { topic: string; stage: GardenStage; core: boolean; archived?: boolean; archivedReason?: string }> = {
	// 1. 数字基地与 2C2G 自托管
	"astro-mizuki-blog-from-zero": { topic: "server-selfhost", stage: "evergreen", core: true },
	"free-domain-and-web-community": { topic: "server-selfhost", stage: "evergreen", core: true },
	"cloudflare-free-tier-student-guide/cloudflare-free-tier-developer-guide": { topic: "server-selfhost", stage: "evergreen", core: true },
	"sayori-server-01-vps-start": { topic: "server-selfhost", stage: "evergreen", core: true },
	"docker-compose-minimum-start": { topic: "server-selfhost", stage: "evergreen", core: true },
	"student-2c2g-server-service-index/2c2g-server-service-index": { topic: "server-selfhost", stage: "evergreen", core: true },
	"selfhost-ntfy-on-2c2g": { topic: "server-selfhost", stage: "budding", core: true },
	"fast-note-sync-on-student-server": { topic: "server-selfhost", stage: "budding", core: true },
	"selfhost-vaultwarden-on-2c2g": { topic: "server-selfhost", stage: "evergreen", core: true },
	"make-home-server": { topic: "server-selfhost", stage: "budding", core: true },

	// 2. 独立游戏与 Godot 开发
	"godot-development-notes": { topic: "godot-gamedev", stage: "budding", core: true },
	"godot-useful-plugins": { topic: "godot-gamedev", stage: "budding", core: true },
	"steam-dev-work-01": { topic: "godot-gamedev", stage: "evergreen", core: true },
	"re0-game-dev-life": { topic: "godot-gamedev", stage: "budding", core: false },
	"after-gmtk": { topic: "godot-gamedev", stage: "budding", core: false },
	"subarutap-and-selfthink": { topic: "godot-gamedev", stage: "budding", core: false },

	// 3. AI 工作流与学生开发权益
	"build-your-search-gateway": { topic: "ai-student-dev", stage: "budding", core: true },
	"geoscore-2-4-guide": { topic: "ai-student-dev", stage: "budding", core: true },
	"edumails-glados-student-benefits": { topic: "ai-student-dev", stage: "evergreen", core: true },
	"azure-students-100-credit-guide": { topic: "ai-student-dev", stage: "evergreen", core: true },
	"aliyun-student-300-voucher-guide": {
		topic: "ai-student-dev",
		stage: "budding",
		core: true,
		archived: true,
		archivedReason: "本文涉及的高校 300 元代金券规则与机型价格基于 2026 年实测，活动批次与抵扣范围请以阿里云官网结算页当前显示为准。",
	},
	"anyrouter-sharedchat-cc-switch-student-guide": {
		topic: "ai-student-dev",
		stage: "budding",
		core: true,
		archived: true,
		archivedReason: "本文提及的官方免费层与第三方公益/中转服务额度随上游策略变化较快，配置前请先核对各平台当前可用状态。",
	},
	"ai-labor-pains": { topic: "ai-student-dev", stage: "budding", core: false },
	"some-future-expectations": { topic: "ai-student-dev", stage: "seedling", core: false },
	"deals-2026-09-21": {
		topic: "ai-student-dev",
		stage: "seedling",
		core: false,
		archived: true,
		archivedReason: "本文为 2026-09-21 当天的短期活动线索记录，部分权益可能已结束，仅作历史归档留存。",
	},

	// 4. 新手锻炼与健康生活
	"beginner-fitness-01": { topic: "fitness-health", stage: "evergreen", core: true },
	"beginner-fitness-02": { topic: "fitness-health", stage: "evergreen", core: true },
	"beginner-fitness-03": { topic: "fitness-health", stage: "evergreen", core: true },
	"beginner-fitness-04": { topic: "fitness-health", stage: "evergreen", core: true },

	// 5. 工具箱、开源服务与社区图谱
	"site-article-index": { topic: "toolbox-community", stage: "evergreen", core: true },
	"resource-index": { topic: "toolbox-community", stage: "evergreen", core: true },
	"useful-free-software-toolbox": { topic: "toolbox-community", stage: "evergreen", core: true },
	"useful-browser-extensions-toolbox": { topic: "toolbox-community", stage: "evergreen", core: true },
	"webmaster-resource-toolbox": { topic: "toolbox-community", stage: "evergreen", core: true },
	"cn-internet-community-map/internet-community-map": { topic: "toolbox-community", stage: "budding", core: true },
	"disroot-open-services-note": { topic: "toolbox-community", stage: "seedling", core: true },
	"radical-servers-public-services": { topic: "toolbox-community", stage: "seedling", core: true },
	"internet-community-1": { topic: "toolbox-community", stage: "seedling", core: false },
	"internet-community-2-bangumi-and-doki/internet-community-2": { topic: "toolbox-community", stage: "seedling", core: false },
	"internet-community-3": { topic: "toolbox-community", stage: "seedling", core: false },

	// 6. 创作者自省与深度阅读
	"blog-author-9-questions-answer": { topic: "creator-mindset", stage: "budding", core: false },
	"independent-blog-self-check-15-draft": { topic: "creator-mindset", stage: "budding", core: false },
	"creaters-confidence-circle": { topic: "creator-mindset", stage: "evergreen", core: true },
	"if-i-stopped-creating": { topic: "creator-mindset", stage: "budding", core: false },
	"weakly-articles-01": { topic: "creator-mindset", stage: "seedling", core: true },
	"weakly-articles-02": { topic: "creator-mindset", stage: "budding", core: true },

	// 7. 理性思辨、隐私与外部观察
	"from-90-to-667": { topic: "rationality-privacy", stage: "evergreen", core: false },
	"i-call-too-many-thing-rational": { topic: "rationality-privacy", stage: "budding", core: false },
	"i-tried-to-measure-everything-by-value": { topic: "rationality-privacy", stage: "budding", core: false },
	"when-i-finnally-relax": { topic: "rationality-privacy", stage: "budding", core: false },
	"cn-university-studient-portraits/cn-university-student-portaits": { topic: "rationality-privacy", stage: "budding", core: false },
	"ai-self-doxxing-experiment": { topic: "rationality-privacy", stage: "budding", core: false },
	"cross-app-tracking-device-fingerprinting": {
		topic: "rationality-privacy",
		stage: "evergreen",
		core: true,
		archived: true,
		archivedReason: "本文为移动广告画像与设备指纹科普授权转载归档，保留原帖链接供交叉查阅。",
	},

	// 8. 成长档案与三次元足迹
	"hello-sayori": { topic: "growth-footprints", stage: "seedling", core: false },
	"before-18-record": { topic: "growth-footprints", stage: "evergreen", core: false },
	"age-18-to-19-record": { topic: "growth-footprints", stage: "evergreen", core: false },
	"ziwojieshao/self-introduction": { topic: "growth-footprints", stage: "evergreen", core: false },
	"summer-2026-end": { topic: "growth-footprints", stage: "budding", core: false },
	"first-hong-kong": { topic: "growth-footprints", stage: "budding", core: false },
	"blog-style-change": { topic: "growth-footprints", stage: "budding", core: false },
	"meta-note": { topic: "growth-footprints", stage: "seedling", core: false },
};

/**
 * Reading editions outside the three core locales only build `/`, `/archive/`,
 * `/essays/` and `/privacy/`, so their garden links point at the canonical
 * garden instead of a route that is pruned from their output.
 */
export function getGardenUrl(hash = ""): string {
	const suffix = hash ? `#${hash.replace(/^#/, "")}` : "";
	return isExtraLocale ? `/garden/${suffix}` : url(`/garden/${suffix}`);
}

export function toCanonicalGardenSlug(postIdOrSlug: string): string {
	const cleaned = removeFileExtension(String(postIdOrSlug || ""))
		.trim()
		.replace(/^\/+|\/+$/g, "")
		.replace(/^posts\//i, "");
	return cleaned
		.split("/")
		.filter(Boolean)
		.map((segment) =>
			segment
				.normalize("NFKD")
				.toLowerCase()
				.trim()
				.replace(/[.\u0027\u2019]/g, "")
				.replace(/[^\p{Letter}\p{Number}]+/gu, "-")
				.replace(/^-+|-+$/g, ""),
		)
		.join("/");
}

export function getTopicCopy(topic: GardenTopicDefinition): { title: string; subtitle: string } {
	if (isEnglishSite) {
		return { title: topic.title.en, subtitle: topic.subtitle.en };
	}
	if (isTraditionalSite) {
		return { title: topic.title.hant, subtitle: topic.subtitle.hant };
	}
	return { title: topic.title.zh, subtitle: topic.subtitle.zh };
}

export function getStageLabel(stage: GardenStage): { icon: string; name: string; desc: string } {
	if (isEnglishSite) {
		switch (stage) {
			case "evergreen":
				return { icon: "🌲", name: "Evergreen", desc: "Complete, reference-ready note" };
			case "budding":
				return { icon: "🌿", name: "Budding", desc: "Growing note with ongoing updates" };
			default:
				return { icon: "🌱", name: "Seedling", desc: "Initial idea or early field note" };
		}
	}
	if (isTraditionalSite) {
		switch (stage) {
			case "evergreen":
				return { icon: "🌲", name: "常青", desc: "結構完整、可長期查閱的筆記" };
			case "budding":
				return { icon: "🌿", name: "生長中", desc: "持續補充與修剪中的主題筆記" };
			default:
				return { icon: "🌱", name: "新芽", desc: "初步記錄或剛種下的想法" };
		}
	}
	switch (stage) {
		case "evergreen":
			return { icon: "🌲", name: "常青", desc: "结构完整、可长期查阅的笔记" };
		case "budding":
			return { icon: "🌿", name: "生长中", desc: "持续补充与修剪中的主题笔记" };
		default:
			return { icon: "🌱", name: "新芽", desc: "初步记录或刚种下的想法" };
	}
}

function inferTopicAndStage(post: CollectionEntry<"posts">, slug: string): {
	topicId: string;
	stage: GardenStage;
	isGardenCore: boolean;
	archived: boolean;
	archivedReason: string;
} {
	const preset = SLUG_TOPIC_MAP[slug];
	const explicitTopic = post.data.topic?.trim();
	const explicitStage = post.data.stage;
	const explicitType = post.data.type;
	const updateCount = post.data.updateCount ?? 0;

	let topicId = explicitTopic || preset?.topic || "";
	if (!topicId) {
		const tags = (post.data.tags ?? []).join(" ").toLowerCase();
		const category = String(post.data.category || "");
		if (/godot|steam|game jam|独立游戏|游戏开发/.test(tags)) topicId = "godot-gamedev";
		else if (/docker|vps|cloudflare|自托管|家里云|建站/.test(tags)) topicId = "server-selfhost";
		else if (/健身|跑步|锻炼|有氧|饮食/.test(tags)) topicId = "fitness-health";
		else if (/ai|官方学生权益|azure|阿里云|教育邮箱|geo/.test(tags)) topicId = "ai-student-dev";
		else if (/社区|开源服务|工具|浏览器扩展/.test(tags)) topicId = "toolbox-community";
		else if (/理性|隐私|大学观察|设备指纹/.test(tags)) topicId = "rationality-privacy";
		else if (category.includes("主观思考") || category.includes("Subjective")) topicId = "creator-mindset";
		else if (category.includes("教程") || category.includes("Tutorial")) topicId = "server-selfhost";
		else topicId = "growth-footprints";
	}

	let stage: GardenStage =
		explicitStage ||
		preset?.stage ||
		(updateCount >= 3 ? "evergreen" : updateCount >= 1 ? "budding" : "seedling");

	const isGardenCore =
		explicitType === "garden"
			? true
			: explicitType === "blog"
				? false
				: (preset?.core ?? (String(post.data.category || "").includes("教程") || String(post.data.category || "").includes("Tutorial")));

	const archived = Boolean(post.data.archived || explicitType === "archive" || preset?.archived);
	const archivedReason = post.data.archivedReason || preset?.archivedReason || "";

	return { topicId, stage, isGardenCore, archived, archivedReason };
}

export function buildGardenCatalog(posts: CollectionEntry<"posts">[]) {
	const publicPosts = posts.filter(
		(post) => !post.data.encrypted && !post.data.password && (isOrdinaryPublicPost(post) || post.data.section === "deals"),
	);

	const nodeBySlug = new Map<string, GardenNodeMeta>();

	for (const post of publicPosts) {
		const slug = toCanonicalGardenSlug(post.id);
		const { topicId, stage, isGardenCore, archived, archivedReason } = inferTopicAndStage(post, slug);
		const created = post.data.created ?? post.data.published;
		const lastTended = getPostActivityDate(post);
		const updateCount =
			post.data.updateCount ??
			(lastTended.getTime() !== created.getTime() ? 1 : 0);

		nodeBySlug.set(slug, {
			slug,
			postId: post.id,
			title: post.data.title,
			description: getPostPublicDescription(post.data, post.data.title),
			url: getPostUrl(post),
			topicId,
			stage,
			isGardenCore,
			archived,
			archivedReason,
			published: post.data.published,
			lastTended,
			updateCount,
			tags: getPostDisplayTags(post),
			outbound: [],
			backlinks: [],
			degree: 0,
		});
	}

	// Build edges from sync-content static graph + explicit related_posts
	const seenPair = new Set<string>();
	const addEdge = (fromSlug: string, toSlug: string, snippet: string) => {
		const source = nodeBySlug.get(fromSlug);
		const target = nodeBySlug.get(toSlug);
		if (!source || !target || source.slug === target.slug) return;
		const key = `${source.slug}:::${target.slug}`;
		if (seenPair.has(key)) return;
		seenPair.add(key);

		source.outbound.push({
			slug: target.slug,
			title: target.title,
			url: target.url,
			stage: target.stage,
			topicId: target.topicId,
		});
		target.backlinks.push({
			slug: source.slug,
			title: source.title,
			url: source.url,
			stage: source.stage,
			topicId: source.topicId,
			snippet,
		});
	};

	for (const edge of gardenLinkEdges) {
		addEdge(edge.from, edge.to, edge.snippet);
	}

	for (const post of publicPosts) {
		const fromSlug = toCanonicalGardenSlug(post.id);
		for (const related of post.data.related_posts ?? []) {
			const toSlug = toCanonicalGardenSlug(related);
			addEdge(fromSlug, toSlug, "");
		}
	}

	const allNodes = [...nodeBySlug.values()];
	for (const node of allNodes) {
		const neighbors = new Set([
			...node.outbound.map((item) => item.slug),
			...node.backlinks.map((item) => item.slug),
		]);
		node.degree = neighbors.size;
	}

	const topics = GARDEN_TOPICS.map((topic) => {
		const nodes = allNodes
			.filter((node) => node.topicId === topic.id)
			.sort((a, b) => {
				if (topic.hubSlug) {
					if (a.slug === topic.hubSlug) return -1;
					if (b.slug === topic.hubSlug) return 1;
				}
				if (a.isGardenCore !== b.isGardenCore) return a.isGardenCore ? -1 : 1;
				const diff = b.lastTended.getTime() - a.lastTended.getTime();
				return diff !== 0 ? diff : b.published.getTime() - a.published.getTime();
			});
		return {
			...topic,
			copy: getTopicCopy(topic),
			nodes,
		};
	}).filter((topic) => topic.nodes.length > 0);

	return {
		nodeBySlug,
		allNodes,
		topics,
	};
}
