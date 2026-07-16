import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { initPostIdMap } from "@utils/permalink-utils";
import { getCategoryUrl, getPostUrl } from "@utils/url-utils";
import { type CollectionEntry, getCollection } from "astro:content";

type PostVisibilityLike = {
	id: string;
	data: {
		title?: string;
		tags?: string[];
		category?: string | null;
		draft?: boolean;
		essay?: boolean;
		hideHomeContent?: boolean;
	};
};

type PostActivityDateLike = {
	id?: string;
	data: {
		title?: string;
		published: Date;
		created?: Date;
		updated?: Date;
		lastEdited?: Date;
	};
};

type PostPublishedDateLike = {
	id?: string;
	data: {
		title?: string;
		published: Date;
	};
};

const DIARY_DISPLAY_TAG = "日记";
const DIARY_SYSTEM_TAGS = new Set([
	DIARY_DISPLAY_TAG,
	"日常回声",
	"公开整理版",
]);

// Public posts use this small, stable vocabulary. Legacy aliases remain below
// so old content can still render cleanly while the authoring source is updated.
const CANONICAL_PUBLIC_TAGS = new Set([
	"AI",
	"AI API",
	"AI 写作",
	"AI 额度",
	"Astro",
	"Bangumi",
	"Claude Code",
	"Cloudflare",
	"Docker",
	"Doki Chinese Club",
	"Fediverse",
	"GEO",
	"GitHub",
	"Godot",
	"Linux.do",
	"NodeLoc",
	"Obsidian",
	"VPS",
	"Vaultwarden",
	"中文社区",
	"云服务",
	"创作工具",
	"创作资源",
	"写作",
	"原创博客",
	"独立博客",
	"域名",
	"学生服务器",
	"学生资源",
	"密码管理",
	"开源",
	"开源服务",
	"开发工具",
	"成长记录",
	"数字足迹",
	"搜索",
	"插件",
	"新手入门",
	"效率工具",
	"教育邮箱",
	"游戏开发",
	"游戏设计",
	"独立游戏",
	"浏览器扩展",
	"笔记同步",
	"站内导航",
	"站长工具",
	"自托管",
	"软件推荐",
	"论坛",
	"隐私",
	"阿里云",
	"免费资源",
]);

const CATEGORY_ORDER = [
	"建站与自托管",
	"AI 与工作流",
	"工具与资源",
	"游戏开发",
	"互联网与社区",
	"个人记录",
	"日记",
];

const TAG_NORMALIZATION = new Map<string, string>([
	// 内容类型归一化
	["tutorial", "教程"],
	["guide", "教程"],
	["教学", "教程"],
	["叙述", "叙事"],
	["story", "叙事"],
	["narrative", "叙事"],
	["复盘总结", "复盘"],
	["postmortem", "复盘"],
	["总结", "复盘"],
	["资源", "资源整合"],
	["resources", "资源整合"],
	["collection", "资源整合"],

	// 描述性标签归一化
	["真实记录", "随笔"],
	["自我观察", "随笔"],
	["自我怀疑", "随笔"],
	["自省", "随笔"],
	["情绪记录", "随笔"],
	["思考", "随笔"],
	["成长记录", "成长回顾"],
	["个人成长", "成长回顾"],

	// AI 工具细分
	["ai", "AI 工具"],
	["ai工具", "AI 工具"],
	["claude code", "Claude Code"],
	["anyrouter", "AI 额度管理"],
	["sharedchat", "AI 额度管理"],
	["cc-switch", "AI 额度管理"],
	["gpt", "AI 模型"],
	["gemini", "AI 模型"],
	["ai工作流", "AI 工作流"],
	["ai 写作", "AI 写作"],
	["ai写作", "AI 写作"],
	["geo", "GEO"],
	["geoflow", "GEO"],
	["生成式引擎优化", "GEO"],
	["内容工程", "内容工程"],
	["内容工厂", "内容工程"],

	// 博客搭建细分
	["astro", "博客技术栈"],
	["mizuki", "博客技术栈"],
	["obsidian", "博客工作流"],
	["图文教程", "博客教程"],
	["视频配套", "博客教程"],
	["blog", "博客搭建"],
	["博客", "博客搭建"],
	["个人博客", "博客搭建"],
	["独立博客", "博客搭建"],
	["站长社区", "站长社区"],
	["开往", "站长社区"],
	["萌备", "站长社区"],
	["免费域名", "域名和托管"],
	["dnshe", "域名和托管"],
	["cloudflare pages", "域名和托管"],
	["域名", "域名和托管"],

	// 服务器和自托管细分
	["vps", "VPS 服务器"],
	["ssh", "VPS 服务器"],
	["ufw", "VPS 服务器"],
	["阿里云", "云服务商"],
	["学生优惠", "云服务商"],
	["cloudflare", "Cloudflare"],
	["cloudflare tunnel", "Cloudflare"],
	["docker", "Docker 自托管"],
	["docker compose", "Docker 自托管"],
	["vaultwarden", "自托管服务"],
	["ntfy", "自托管服务"],
	["fast note sync", "自托管服务"],
	["gatus", "自托管服务"],
	["2c2g", "学生服务器"],
	["轻量应用服务器", "学生服务器"],
	["个人服务器", "服务器探索"],
	["自托管", "自托管"],
	["密码管理", "密码管理"],
	["推送通知", "推送通知"],
	["监控", "监控"],

	// 开源和 GitHub
	["github", "开源"],
	["github actions", "开源"],
	["开源", "开源"],

	// 资源分享
	["资源分享", "资源整合"],
	["bookmarks", "资源整合"],
	["tools", "资源整合"],
	["工具箱", "资源整合"],
	["站长工具箱", "资源整合"],

	// 游戏开发
	["godot", "游戏开发"],
	["gamedev", "游戏开发"],
	["游戏开发", "游戏开发"],
	["独立游戏", "游戏开发"],
	["游戏玩后感", "游戏开发"],
	["游戏设计", "游戏开发"],
	["outcore", "游戏开发"],
	["boundary window", "游戏开发"],
	["booom jam", "游戏开发"],

	// 学习记录
	["计划", "学习记录"],
	["学习计划", "学习记录"],
	["学习系统", "学习记录"],
	["大学生", "学习记录"],
	["校园", "学习记录"],
	["美术学习", "学习记录"],
	["像素画", "学习记录"],

	// 读者定位
	["学生向", "学生向"],
	["新手友好", "新手友好"],
	["新手", "新手友好"],
	["入门", "新手友好"],

	// 社区和观察
	["nodeloc", "互联网观察"],
	["linux.do", "互联网观察"],
	["中文社区", "互联网观察"],
	["互联网观察", "互联网观察"],
	["小众社区", "互联网观察"],
	["论坛", "互联网观察"],
]);

// 公开日记只在时间线等按日期浏览的页面集中展示，避免首页文章流被日记刷屏。
export function isDiaryPost(post: PostVisibilityLike): boolean {
	const tags = post.data.tags ?? [];
	return (
		post.id.startsWith("diary/") ||
		post.data.title?.startsWith("日记：") ||
		tags.includes("日记")
	);
}

export function isPublishedPost(post: PostVisibilityLike): boolean {
	return post.data.draft !== true;
}

export function isEssayPost(post: PostVisibilityLike): boolean {
	return isPublishedPost(post) && post.data.essay === true;
}

export function isHomeListPost(post: PostVisibilityLike): boolean {
	return (
		isPublishedPost(post) &&
		!isDiaryPost(post) &&
		!isEssayPost(post) &&
		post.data.hideHomeContent !== true
	);
}

export function isOrdinaryPublicPost(post: PostVisibilityLike): boolean {
	return isPublishedPost(post) && !isDiaryPost(post) && !isEssayPost(post);
}

function normalizeDisplayTag(tag: string): string {
	const trimmed = tag.trim();
	if (CANONICAL_PUBLIC_TAGS.has(trimmed)) {
		return trimmed;
	}
	const normalized = TAG_NORMALIZATION.get(trimmed.toLowerCase());
	return normalized ?? trimmed;
}

export function getPostDisplayTags(post: PostVisibilityLike): string[] {
	if (isDiaryPost(post)) {
		return [DIARY_DISPLAY_TAG];
	}

	const seen = new Set<string>();
	const displayTags: string[] = [];
	for (const tag of post.data.tags ?? []) {
		const trimmed = normalizeDisplayTag(tag);
		if (!trimmed || DIARY_SYSTEM_TAGS.has(trimmed) || seen.has(trimmed)) {
			continue;
		}
		seen.add(trimmed);
		displayTags.push(trimmed);
	}
	return displayTags;
}

export function getPostActivityDate(post: PostActivityDateLike): Date {
	return (
		post.data.lastEdited ??
		post.data.updated ??
		post.data.created ??
		post.data.published
	);
}

function comparePostsByActivity(
	a: PostActivityDateLike,
	b: PostActivityDateLike,
): number {
	const activityDiff =
		getPostActivityDate(b).getTime() - getPostActivityDate(a).getTime();
	if (activityDiff !== 0) {
		return activityDiff;
	}

	const publishedDiff =
		b.data.published.getTime() - a.data.published.getTime();
	if (publishedDiff !== 0) {
		return publishedDiff;
	}

	return (a.id ?? a.data.title ?? "").localeCompare(
		b.id ?? b.data.title ?? "",
	);
}

export function comparePostsByPublishedDate(
	a: PostPublishedDateLike,
	b: PostPublishedDateLike,
): number {
	const publishedDiff =
		b.data.published.getTime() - a.data.published.getTime();
	if (publishedDiff !== 0) {
		return publishedDiff;
	}

	return (a.id ?? a.data.title ?? "").localeCompare(
		b.id ?? b.data.title ?? "",
	);
}

export function sortPostsByPublishedDateDesc<T extends PostPublishedDateLike>(
	posts: T[],
): T[] {
	return [...posts].sort(comparePostsByPublishedDate);
}

// Retrieve posts and sort them by activity date.
async function getRawSortedPosts() {
	const allBlogPosts = await getCollection("posts", ({ data }) => {
		return data.draft !== true;
	});

	const sorted = allBlogPosts.sort((a, b) => {
		// 首先按置顶状态排序，置顶文章在前
		if (a.data.pinned && !b.data.pinned) {
			return -1;
		}
		if (!a.data.pinned && b.data.pinned) {
			return 1;
		}

		// 如果置顶状态相同，优先按 Priority 排序（数值越小越靠前）
		if (a.data.pinned && b.data.pinned) {
			const priorityA = a.data.priority;
			const priorityB = b.data.priority;
			if (priorityA !== undefined && priorityB !== undefined) {
				if (priorityA !== priorityB) {
					return priorityA - priorityB;
				}
			} else if (priorityA !== undefined) {
				return -1;
			} else if (priorityB !== undefined) {
				return 1;
			}
		}

		// 否则按最后活动时间排序，让近期修改过的文章回到列表前面。
		return comparePostsByActivity(a, b);
	});
	return sorted;
}

export async function getSortedPosts() {
	const sorted = (await getRawSortedPosts()).filter(
		(post) => !isEssayPost(post),
	);

	for (const post of sorted) {
		post.data.nextSlug = "";
		post.data.nextTitle = "";
		post.data.prevSlug = "";
		post.data.prevTitle = "";
	}

	for (const posts of [
		sorted.filter((post) => !isDiaryPost(post)),
		sorted.filter((post) => isDiaryPost(post)),
	]) {
		for (let i = 1; i < posts.length; i++) {
			posts[i].data.nextSlug = posts[i - 1].id;
			posts[i].data.nextTitle = posts[i - 1].data.title;
		}
		for (let i = 0; i < posts.length - 1; i++) {
			posts[i].data.prevSlug = posts[i + 1].id;
			posts[i].data.prevTitle = posts[i + 1].data.title;
		}
	}

	return sorted;
}
export interface PostForList {
	id: string;
	data: CollectionEntry<"posts">["data"];
	url?: string; // 预计算的文章 URL
}
export async function getSortedPostsList(): Promise<PostForList[]> {
	const sortedFullPosts = (await getRawSortedPosts()).filter(
		(post) => !isEssayPost(post),
	);

	// 初始化文章 ID 映射（用于 permalink 功能）
	initPostIdMap(sortedFullPosts);

	// delete post.body，并预计算 URL
	const sortedPostsList = sortedFullPosts.map((post) => ({
		id: post.id,
		data: post.data,
		url: getPostUrl(post),
	}));

	return sortedPostsList;
}

export async function getEssayPosts() {
	const essays = await getCollection<"essays">("essays", ({ data }) => {
		return data.draft !== true;
	});
	return sortPostsByPublishedDateDesc(essays);
}

export interface Tag {
	name: string;
	count: number;
}

export interface TagListOptions {
	includeDiary?: boolean;
	sortBy?: "name" | "count";
	minCount?: number;
	limit?: number;
}

export async function getTagList(options?: TagListOptions): Promise<Tag[]> {
	const allBlogPosts = await getCollection<"posts">("posts", ({ data }) => {
		return data.draft !== true;
	});
	const posts = allBlogPosts.filter((post) => {
		if (isEssayPost(post)) {
			return false;
		}
		return options?.includeDiary === true || !isDiaryPost(post);
	});

	const countMap: Record<string, number> = {};
	posts.forEach((post) => {
		getPostDisplayTags(post).forEach((tag: string) => {
			if (!countMap[tag]) {
				countMap[tag] = 0;
			}
			countMap[tag]++;
		});
	});

	const minCount = Math.max(1, Math.trunc(options?.minCount ?? 1));
	const tags = Object.entries(countMap)
		.map(([name, count]) => ({ name, count }))
		.filter((tag) => tag.count >= minCount)
		.sort((a, b) => {
			if (options?.sortBy === "count" && a.count !== b.count) {
				return b.count - a.count;
			}
			return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
		});

	if (options?.limit === undefined) {
		return tags;
	}

	return tags.slice(0, Math.max(0, Math.trunc(options.limit)));
}

export interface Category {
	name: string;
	count: number;
	url: string;
}

export async function getCategoryList(options?: {
	includeDiary?: boolean;
}): Promise<Category[]> {
	const allBlogPosts = await getCollection<"posts">("posts", ({ data }) => {
		return data.draft !== true;
	});
	const posts = allBlogPosts.filter((post) => {
		if (isEssayPost(post)) {
			return false;
		}
		return options?.includeDiary === true || !isDiaryPost(post);
	});
	const count: Record<string, number> = {};
	posts.forEach((post: { data: { category: string | null } }) => {
		if (!post.data.category) {
			const ucKey = i18n(I18nKey.uncategorized);
			count[ucKey] = count[ucKey] ? count[ucKey] + 1 : 1;
			return;
		}

		const categoryName =
			typeof post.data.category === "string"
				? post.data.category.trim()
				: String(post.data.category).trim();

		count[categoryName] = count[categoryName] ? count[categoryName] + 1 : 1;
	});

	const lst = Object.keys(count).sort((a, b) => {
		const rankA = CATEGORY_ORDER.indexOf(a);
		const rankB = CATEGORY_ORDER.indexOf(b);
		if (rankA !== -1 || rankB !== -1) {
			return (rankA === -1 ? Number.MAX_SAFE_INTEGER : rankA) -
				(rankB === -1 ? Number.MAX_SAFE_INTEGER : rankB);
		}
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	const ret: Category[] = [];
	for (const c of lst) {
		ret.push({
			name: c,
			count: count[c],
			url: getCategoryUrl(c),
		});
	}
	return ret;
}

/**
 * 对标题进行分词，支持中英文混合
 *
 * - 优先使用 Intl.Segmenter（在支持的运行时中效果更好）
 * - 在不支持 Segmenter 的环境（如部分 Node 运行时）下
 *   回退到基于正则的简单分词，以避免构建报错
 * - 过滤标点和空白，英文统一小写
 */
function tokenizeTitle(title: string): Set<string> {
	const tokens = new Set<string>();

	// 运行时可能不支持 Intl.Segmenter（例如部分 Node 环境）
	// 为了避免 SSR/构建时报错，这里做兼容处理
	const hasSegmenter =
		typeof Intl !== "undefined" &&
		"Segmenter" in Intl &&
		typeof (Intl as any).Segmenter === "function";

	if (!hasSegmenter) {
		// 简单回退方案：按照空白和标点拆分
		const basicTokens = title
			.toLowerCase()
			.split(/[\s\p{P}]+/gu)
			.filter(Boolean);
		for (const t of basicTokens) {
			tokens.add(t);
		}
		return tokens;
	}

	// 使用 Intl.Segmenter 进行更精细的中英文混合分词
	const segmenter = new (Intl as any).Segmenter("zh", {
		granularity: "word",
	});
	for (const { segment, isWordLike } of segmenter.segment(title)) {
		if (!isWordLike) {
			continue;
		}
		tokens.add((segment as string).toLowerCase());
	}
	return tokens;
}

/**
 * 计算两个集合的 Jaccard 相似度
 */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
	if (a.size === 0 && b.size === 0) {
		return 0;
	}
	let intersection = 0;
	for (const item of a) {
		if (b.has(item)) {
			intersection++;
		}
	}
	const union = a.size + b.size - intersection;
	return union === 0 ? 0 : intersection / union;
}

/**
 * 获取相关文章推荐
 * 评分公式: totalScore = tagMatchScore + titleSimilarityScore + timeFreshnessScore + categoryBonus
 * - tagMatchScore (0-150): 标签 Jaccard 相似度 × 150 (提高权重)
 * - titleSimilarityScore (0-50): 标题分词 Jaccard 相似度 × 50 (降低权重)
 * - timeFreshnessScore (0-10): 6 个月半衰期指数衰减 (大幅降低权重)
 * - categoryBonus (0 or 30): 同分类加 30 分 (提高权重)
 */
export async function getRelatedPosts(
	currentPost: CollectionEntry<"posts">,
	maxCount = 5,
): Promise<PostForList[]> {
	const allPosts = await getCollection<"posts">("posts", ({ data }) => {
		return data.draft !== true;
	});

	// 排除自身和加密文章
	const candidates = allPosts.filter(
		(p) =>
			p.id !== currentPost.id &&
			!p.data.password &&
			isOrdinaryPublicPost(p),
	);

	const currentTags = new Set(getPostDisplayTags(currentPost));
	const currentTokens = tokenizeTitle(currentPost.data.title);
	const currentCategory = currentPost.data.category || "";
	const now = Date.now();

	const scored = candidates.map((post) => {
		const postTags = new Set(getPostDisplayTags(post));

		// tagMatchScore (0-150) - 提高标签匹配权重
		const tagMatchScore = jaccardSimilarity(currentTags, postTags) * 150;

		// titleSimilarityScore (0-50) - 降低标题相似度权重
		const postTokens = tokenizeTitle(post.data.title);
		const titleSimilarityScore =
			jaccardSimilarity(currentTokens, postTokens) * 50;

		// timeFreshnessScore (0-10) - 大幅降低时间权重
		const daysSincePublished =
			(now - new Date(post.data.published).getTime()) /
			(1000 * 60 * 60 * 24);
		const timeFreshnessScore =
			10 * Math.exp((-Math.LN2 * daysSincePublished) / 180);

		// categoryBonus (0 or 30) - 提高同分类加分
		const postCategory = post.data.category || "";
		const categoryBonus =
			currentCategory && postCategory && currentCategory === postCategory
				? 30
				: 0;

		const totalScore =
			tagMatchScore +
			titleSimilarityScore +
			timeFreshnessScore +
			categoryBonus;

		return {
			post,
			totalScore,
			tagMatchScore,
			timeFreshnessScore,
			categoryBonus,
		};
	});

	// 按总分降序排列
	scored.sort((a, b) => b.totalScore - a.totalScore);

	// 优先取有标签匹配的
	const withTagMatch = scored.filter((s) => s.tagMatchScore > 0);
	const withoutTagMatch = scored.filter((s) => s.tagMatchScore === 0);

	const result: PostForList[] = [];

	for (const s of withTagMatch) {
		if (result.length >= maxCount) {
			break;
		}
		result.push({ id: s.post.id, data: s.post.data });
	}

	// 不足时从剩余候选中按 categoryBonus + timeFreshnessScore 降序补充
	if (result.length < maxCount) {
		withoutTagMatch.sort(
			(a, b) =>
				b.categoryBonus +
				b.timeFreshnessScore -
				(a.categoryBonus + a.timeFreshnessScore),
		);
		for (const s of withoutTagMatch) {
			if (result.length >= maxCount) {
				break;
			}
			result.push({ id: s.post.id, data: s.post.data });
		}
	}

	return result;
}
