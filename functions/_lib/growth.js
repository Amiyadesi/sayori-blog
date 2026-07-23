const DAY_MS = 86_400_000;
const SNAPSHOT_RETENTION_MS = 30 * DAY_MS;
const DETAIL_RETENTION_MS = 180 * DAY_MS;
const PRUNE_INTERVAL_MS = DAY_MS;
const DEVLOG_REMINDER_MS = 14 * DAY_MS;

export const GROWTH_TOPIC_STATUSES = new Set([
	"candidate",
	"draft",
	"published",
	"archived",
]);

export const GROWTH_MEDIA = new Set([
	"community",
	"video",
	"social",
	"repository",
	"referral",
	"feed",
	"email",
	"offline",
]);

export const GROWTH_SOURCE_STATUSES = new Set([
	"complete",
	"partial",
	"not_configured",
	"error",
]);

export const GROWTH_TOPIC_SEEDS = [
	{
		slug: "game-development",
		title: "游戏开发与 Game Jam",
		status: "draft",
		priority: 100,
		audience: [
			"正在用 Godot 做独立游戏和 Game Jam 的开发者",
			"想看从玩法原型到发布复盘完整过程的人",
		],
		articlePaths: [
			"/posts/godot-useful-plugins/",
			"/posts/re0game-dev-life/",
			"/posts/age-18-to-19-record/",
			"/posts/before-18-record/",
		],
		evidence: [
			"WakeUpAtTheBorder 获 GodotHub 第三届开发大赛二等奖",
			"TimeRewindLinker 已发布至 itch.io，并完成 11 个关卡",
			"Mio's Window Wanderer 与少女们的假面舞会来自连续 Game Jam 实践",
			"现有文章覆盖 Godot 插件、长期开发记录、Jam 复盘与玩法实验",
		],
		works: [
			{
				label: "itch.io 作品页",
				url: "https://amiya-desi.itch.io/",
			},
			{
				label: "WakeUpAtTheBorder",
				url: "https://github.com/Amiyadesi/Wake-up-at-the-border",
			},
		],
		contentGaps: [
			"为每个可玩作品补一篇短而完整的项目页或 Devlog",
			"把玩法约束、失败原因和可复现技术方案分别串成阅读路线",
			"补充当前项目的公开里程碑与试玩入口",
		],
		questions: [
			"这些 Game Jam 项目分别解决了什么设计问题",
			"Godot 项目中哪些工具和工作流可以复用",
			"如何从失败原型提炼下一次可验证的里程碑",
		],
		startingPath: [
			"先从一个可玩的作品或 Game Jam 复盘开始",
			"再阅读对应的 Godot 工具与实现记录",
			"最后查看失败原型和下一阶段里程碑",
		],
	},
	{
		slug: "webmaster",
		title: "个人站长工具箱",
		status: "published",
		priority: 80,
		audience: ["个人博客作者和独立站长"],
		articlePaths: ["/topics/webmaster/"],
		evidence: ["公开专题页已经存在并由 Git 仓库维护"],
		works: [],
		contentGaps: [],
		questions: [],
		startingPath: [],
	},
	{
		slug: "student-ai-resources",
		title: "学生资源与 AI",
		status: "candidate",
		priority: 50,
		audience: ["需要低成本开发资源的学生"],
		articlePaths: [
			"/posts/aliyun-student-300-voucher-guide/",
			"/posts/anyrouter-sharedchat-cc-switch-student-guide/",
			"/posts/freeapi-glm-kimi-cc-switch/",
		],
		evidence: ["已有多篇稳定获得搜索落地的学生资源文章"],
		works: [],
		contentGaps: ["按用途而不是优惠来源建立长期可维护入口"],
		questions: [],
		startingPath: [],
	},
	{
		slug: "self-hosting-2c2g",
		title: "2C2G 自托管",
		status: "candidate",
		priority: 45,
		audience: ["想在小服务器上部署可靠服务的人"],
		articlePaths: [
			"/posts/student-2c2g-server-service-index/2c2g-server-service-index/",
			"/posts/selfhost-vaultwarden-on-2c2g/",
			"/posts/selfhost-ntfy-on-2c2g/",
		],
		evidence: ["已有服务索引和两篇可复现部署文章"],
		works: [],
		contentGaps: ["补容量边界、失败恢复和维护成本对照"],
		questions: [],
		startingPath: [],
	},
	{
		slug: "chinese-internet-communities",
		title: "中文互联网社区",
		status: "candidate",
		priority: 40,
		audience: ["寻找中文技术和兴趣社区的人"],
		articlePaths: [
			"/posts/internet-community-1/",
			"/posts/internet-community-2-bangumi-and-doki/internet-community-2/",
			"/posts/cn-internet-community-map/internet-community-map/",
		],
		evidence: ["已有社区观察、地图和垂直社区记录"],
		works: [],
		contentGaps: ["补社区规则、适合讨论类型和更新时间"],
		questions: [],
		startingPath: [],
	},
];

function text(value, limit = 400) {
	return String(value || "").normalize("NFKC").trim().slice(0, limit);
}

function parseJson(value, fallback) {
	if (typeof value !== "string" || !value) return fallback;
	try {
		return JSON.parse(value);
	} catch {
		return fallback;
	}
}

function safeArray(value, limit = 50) {
	return Array.isArray(value) ? value.slice(0, limit) : [];
}

export function normalizeBlogTarget(value) {
	let url;
	try {
		url = new URL(text(value, 2048), "https://blog.sayori.org");
	} catch {
		throw new Error("请输入有效的 blog.sayori.org 地址");
	}
	if (
		url.protocol !== "https:" ||
		url.hostname !== "blog.sayori.org" ||
		url.port ||
		url.username ||
		url.password
	) {
		throw new Error("目标必须是 https://blog.sayori.org 的页面");
	}
	url.hash = "";
	return url;
}

export function normalizeGrowthQueries(values, fallbackTitle = "") {
	const input = Array.isArray(values) ? values : [];
	const normalized = [];
	for (const value of input) {
		const query = text(value, 200).replace(/\s+/g, " ");
		if (query && !normalized.some((item) => item.toLowerCase() === query.toLowerCase())) {
			normalized.push(query);
		}
		if (normalized.length >= 3) break;
	}
	if (normalized.length) return normalized;
	const title = text(fallbackTitle, 160);
	return title ? [title, `${title} 教程`, `${title} 经验`] : [];
}

export function sourceConfiguration(env) {
	return {
		search_gateway: Boolean(env.SEARCH_GATEWAY_BASE_URL && env.SEARCH_GATEWAY_API_KEY),
		geoscore: Boolean(env.GEOSCORE_API_URL && env.GEOSCORE_ADMIN_TOKEN),
		umami: Boolean(env.UMAMI_API_URL && env.UMAMI_API_TOKEN && env.UMAMI_WEBSITE_ID),
		gsc: Boolean(env.GSC_SERVICE_ACCOUNT_JSON),
	};
}

export function buildInitialActions(
	{
		topics = [],
		snapshots = [],
		channels = [],
		tasks = [],
		campaigns = [],
	} = {},
	now = Date.now(),
) {
	const activeTasks = tasks.filter((item) => item.status !== "done" && item.status !== "archived");
	const actions = activeTasks.slice(0, 3).map((item) => ({
		id: `task:${item.id}`,
		type: "task",
		title: item.title,
		reason: item.reason || "来自最近一次真实分析",
		priority: item.priority || "normal",
		target: item.post_path || "",
	}));

	if (actions.length < 3) {
		const gameTopic = topics.find((topic) => topic.slug === "game-development");
		if (gameTopic && gameTopic.status !== "published") {
			actions.push({
				id: "review:game-development",
				type: "review_topic",
				title: "审核游戏开发专题草稿",
				reason: `${safeArray(gameTopic.evidence).length || 4} 条长期作品与文章证据已整理`,
				priority: "high",
				target: "game-development",
			});
		}
	}

	if (actions.length < 3 && snapshots.length === 0) {
		actions.push({
			id: "analyze:first-post",
			type: "analyze",
			title: "选择一篇文章建立首个四源基线",
			reason: "当前没有保存的 Search、GeoScore、Umami 或 GSC 分析快照",
			priority: "high",
			target: "",
		});
	}

	if (actions.length < 3 && channels.length === 0) {
		actions.push({
			id: "channel:first-profile",
			type: "channel",
			title: "登记一个真实使用的渠道",
			reason: "当前没有渠道规则和历史效果档案",
			priority: "normal",
			target: "",
		});
	}

	if (actions.length < 3) {
		const dueCampaign = campaigns
			.filter(
				(campaign) =>
					campaign.status === "published" &&
					Number.isFinite(Number(campaign.reviewDueAt)) &&
					Number(campaign.reviewDueAt) <= now,
			)
			.sort((left, right) => Number(left.reviewDueAt) - Number(right.reviewDueAt))[0];
		if (dueCampaign) {
			const visits = Number(dueCampaign.landingVisits || 0);
			actions.push({
				id: `campaign:review:${dueCampaign.id}`,
				type: "review_campaign",
				title: `复盘 Campaign「${dueCampaign.name}」`,
				reason:
					visits >= 20
						? `${visits} 次落地访问已达到评价门槛`
						: `已到复盘日，但目前仅 ${visits} 次落地访问，应标记证据不足`,
				priority: visits >= 20 ? "high" : "normal",
				target: dueCampaign.id,
			});
		}
	}

	if (actions.length < 3) {
		const gameTopic = topics.find((topic) => topic.slug === "game-development");
		if (gameTopic && gameTopic.status !== "archived") {
			const lastMilestoneAt = Number(gameTopic.draft?.lastMilestoneAt);
			if (!Number.isFinite(lastMilestoneAt) || lastMilestoneAt <= 0) {
				actions.push({
					id: "milestone:game-development:missing",
					type: "review_topic",
					title: "记录最近一次游戏开发里程碑",
					reason: "工作台还没有可验证的里程碑日期，不能判断是否需要 Devlog",
					priority: "normal",
					target: "game-development",
				});
			} else if (now - lastMilestoneAt >= DEVLOG_REMINDER_MS) {
				const days = Math.floor((now - lastMilestoneAt) / DAY_MS);
				actions.push({
					id: `devlog:game-development:${lastMilestoneAt}`,
					type: "review_topic",
					title: "整理一篇轻量游戏开发 Devlog",
					reason: `距已记录里程碑 ${days} 天，可记录当前状态、阻塞和下一步`,
					priority: "normal",
					target: "game-development",
				});
			}
		}
	}

	if (actions.length < 3) {
		const candidate = topics.find(
			(topic) =>
				topic.status === "candidate" && safeArray(topic.evidence).length > 0,
		);
		if (candidate) {
			actions.push({
				id: `review:${candidate.slug}`,
				type: "review_topic",
				title: `评估候选专题「${candidate.title}」`,
				reason: `${safeArray(candidate.evidence).length} 条现有证据，仍需人工判断是否值得经营`,
				priority: "normal",
				target: candidate.slug,
			});
		}
	}

	return actions.slice(0, 3);
}

function stableToken(value) {
	let hash = 2166136261;
	for (const character of String(value || "")) {
		hash ^= character.codePointAt(0);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(36);
}

export function buildAnalysisTasks({ targetUrl, topicSlug = "", results = {} }) {
	const target = normalizeBlogTarget(targetUrl);
	const tasks = [];
	const geo = results.geoscore;
	if (geo?.status === "complete" && Array.isArray(geo.data?.failures)) {
		for (const failure of geo.data.failures.slice(0, 20)) {
			const checkId = text(failure.id, 160);
			if (!checkId) continue;
			const evidence = safeArray(failure.evidence, 6).map((item) => text(item, 400)).filter(Boolean);
			tasks.push({
				id: `task:geoscore:${stableToken(`${target.pathname}:${checkId}`)}`,
				topicSlug,
				postPath: target.pathname,
				kind: "geoscore_failure",
				priority:
					failure.severity === "critical"
						? "critical"
						: failure.severity === "major"
							? "high"
							: "normal",
				title: `修复 ${text(failure.title, 240) || checkId}`,
				reason: evidence[0] || `${checkId} 在 GeoScore 中为适用失败项`,
				detail: {
					checkId,
					pageUrl: text(failure.pageUrl, 2048) || target.toString(),
					source: text(failure.source, 120),
					evidence,
					confidence: Number(failure.confidence || 0),
				},
			});
		}
	}

	const gsc = results.gsc;
	if (gsc?.status === "complete" && Array.isArray(gsc.data?.opportunities)) {
		for (const row of gsc.data.opportunities.slice(0, 20)) {
			const query = text(row.query, 300);
			if (!query || Number(row.impressions || 0) < 20) continue;
			tasks.push({
				id: `task:gsc:${stableToken(`${target.pathname}:${query}`)}`,
				topicSlug,
				postPath: target.pathname,
				kind: "search_opportunity",
				priority: "high",
				title: `改进搜索查询「${query}」的落地表现`,
				reason:
					row.reason === "position"
						? `${row.impressions} 次展示，平均排名 ${Number(row.position).toFixed(1)}，处于 4–20 的改进区间`
						: `${row.impressions} 次展示下 CTR 仅 ${(Number(row.ctr || 0) * 100).toFixed(1)}%`,
				detail: {
					query,
					clicks: Number(row.clicks || 0),
					impressions: Number(row.impressions || 0),
					ctr: Number(row.ctr || 0),
					position: Number(row.position || 0),
					reason: row.reason,
				},
			});
		}
	}

	return tasks;
}

export function buildDistributionPackage(input) {
	const target = normalizeBlogTarget(input.target_url);
	const source = text(input.source, 120);
	const medium = text(input.medium, 40);
	const campaign = text(input.campaign, 120);
	const content = text(input.content, 120);
	if (!source || !GROWTH_MEDIA.has(medium) || !campaign) {
		throw new Error("分发包需要有效的 source、medium 和 campaign");
	}
	for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content"]) {
		target.searchParams.delete(key);
	}
	target.searchParams.set("utm_source", source);
	target.searchParams.set("utm_medium", medium);
	target.searchParams.set("utm_campaign", campaign);
	if (content) target.searchParams.set("utm_content", content);

	const facts = safeArray(input.facts, 8).map((item) => text(item, 500)).filter(Boolean);
	const evidence = safeArray(input.evidence, 12).map((item) => text(item, 500)).filter(Boolean);
	if (!facts.length || !evidence.length) {
		throw new Error("分发包至少需要一条可核验事实和一条证据出处");
	}
	const discussionQuestions = safeArray(input.discussion_questions, 5)
		.map((item) => text(item, 300))
		.filter(Boolean);
	const skeleton = [
		"先写清楚这次解决了什么问题，以及为什么值得在这个渠道讨论",
		"给出一个可核验结果、截图、代码或作品入口",
		"列出关键过程和可复现步骤，不复制博客全文",
		"用一个具体问题邀请讨论，再把博客链接放作完整材料入口",
	];
	return {
		version: "1.0",
		created_at: Date.now(),
		target_url: target.toString(),
		channel: {
			name: text(input.channel_name, 120) || source,
			source,
			medium,
			audience: text(input.channel_audience, 500),
			rules: text(input.channel_rules, 1200),
		},
		facts,
		evidence,
		structure: skeleton,
		discussion_questions: discussionQuestions,
		preflight: [
			"正文在没有链接时仍能提供独立价值",
			"事实、数字和作品状态与来源一致",
			"没有复制其他渠道的整段宣传文",
			"UTM source、content 与实际发布位置一致",
		],
		review: {
			due_days: 7,
			minimum_landing_visits: 20,
			primary_metric: "effective_read",
			quality_metric: "effective_read / landing pageview",
		},
		handoff_prompt: [
			"根据下面的可核验证据，为指定渠道起草原生结构",
			"不要虚构数据、用户反馈、引用、成绩或产品能力",
			"不要写成跨平台通用推广文，也不要自动发布",
			`目标：${target.pathname}`,
			`渠道：${source} / ${medium}`,
			`事实：${facts.join("；") || "暂无，必须先补证据"}`,
			`证据：${evidence.join("；") || "暂无，必须先补证据"}`,
		].join("\n"),
	};
}

export function shouldRunPrune(lastPrunedAt, now = Date.now()) {
	return !Number.isFinite(lastPrunedAt) || now - lastPrunedAt >= PRUNE_INTERVAL_MS;
}

export function retentionCutoffs(now = Date.now()) {
	return {
		snapshotsBefore: now - SNAPSHOT_RETENTION_MS,
		detailsBefore: now - DETAIL_RETENTION_MS,
	};
}

export function annualRollupKey(type, timestamp) {
	const year = new Date(timestamp).getUTCFullYear();
	return `${year}:${text(type, 80) || "unknown"}`;
}

export function mapTopicRow(row) {
	return {
		id: row.id,
		slug: row.slug,
		title: row.title,
		status: row.status,
		priority: Number(row.priority || 0),
		audience: parseJson(row.audience_json, []),
		articlePaths: parseJson(row.article_paths_json, []),
		evidence: parseJson(row.evidence_json, []),
		draft: parseJson(row.draft_json, {}),
		updatedAt: Number(row.updated_at || 0),
	};
}

function mapCampaignRow(row) {
	return {
		id: row.id,
		name: row.name,
		status: row.status,
		topicSlug: row.topic_slug,
		postPath: row.post_path,
		source: row.source,
		medium: row.medium,
		content: row.content,
		targetUrl: row.target_url,
		landingVisits: Number(row.landing_visits || 0),
		effectiveReads: Number(row.effective_reads || 0),
		publishedAt: row.published_at,
		reviewDueAt: row.review_due_at,
		metrics: parseJson(row.metrics_json, {}),
	};
}

export async function ensureGrowthSeeds(db, now = Date.now()) {
	const statements = GROWTH_TOPIC_SEEDS.map((seed) =>
		db
			.prepare(
				`INSERT INTO growth_topics
				 (id, slug, title, status, priority, audience_json, article_paths_json, evidence_json, draft_json, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				 ON CONFLICT(slug) DO NOTHING`,
			)
			.bind(
				`topic:${seed.slug}`,
				seed.slug,
				seed.title,
				seed.status,
				seed.priority,
				JSON.stringify(seed.audience),
				JSON.stringify(seed.articlePaths),
				JSON.stringify(seed.evidence),
				JSON.stringify({
					works: seed.works,
					contentGaps: seed.contentGaps,
					questions: seed.questions,
					startingPath: seed.startingPath,
				}),
				now,
				now,
			),
	);
	if (statements.length) await db.batch(statements);
}

export async function listGrowthOverview(db) {
	const [topics, channels, tasks, campaigns, snapshots] = await db.batch([
		db.prepare("SELECT * FROM growth_topics ORDER BY priority DESC, updated_at DESC"),
		db.prepare("SELECT * FROM growth_channels ORDER BY updated_at DESC"),
		db.prepare("SELECT * FROM growth_tasks ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, updated_at DESC LIMIT 100"),
		db.prepare("SELECT * FROM growth_campaigns ORDER BY updated_at DESC LIMIT 100"),
		db.prepare("SELECT * FROM growth_snapshots ORDER BY observed_at DESC LIMIT 40"),
	]);
	return {
		topics: (topics.results || []).map(mapTopicRow),
		channels: (channels.results || []).map((row) => ({
			id: row.id,
			name: row.name,
			source: row.source,
			medium: row.medium,
			entryUrl: row.entry_url,
			audience: row.audience,
			rules: row.rules,
			suitableContent: row.suitable_content,
			lastPublishedAt: row.last_published_at,
			metrics: parseJson(row.metrics_json, {}),
		})),
		tasks: (tasks.results || []).map((row) => ({
			id: row.id,
			topic_slug: row.topic_slug,
			post_path: row.post_path,
			kind: row.kind,
			status: row.status,
			priority: row.priority,
			title: row.title,
			reason: row.reason,
			detail: parseJson(row.detail_json, {}),
			due_at: row.due_at,
			updated_at: row.updated_at,
		})),
		campaigns: (campaigns.results || []).map(mapCampaignRow),
		snapshots: (snapshots.results || []).map((row) => ({
			id: row.id,
			scopeType: row.scope_type,
			scopeKey: row.scope_key,
			source: row.source,
			status: row.status,
			data: parseJson(row.data_json, null),
			errorCode: row.error_code || null,
			observedAt: Number(row.observed_at || 0),
		})),
	};
}

export async function listGrowthCampaignsForPost(db, postPath) {
	const result = await db
		.prepare(
			`SELECT * FROM growth_campaigns
			 WHERE post_path=? AND status IN ('published','reviewed')
			 ORDER BY updated_at DESC LIMIT 12`,
		)
		.bind(text(postPath, 500))
		.all();
	return (result.results || []).map(mapCampaignRow);
}

function optionalMetric(value) {
	if (value === null || value === undefined || value === "") return null;
	const number = Number(value);
	return Number.isFinite(number) && number >= 0 ? number : null;
}

export async function saveCampaignMeasurements(db, measurements, now = Date.now()) {
	const statements = safeArray(measurements, 12).flatMap((measurement) => {
		const id = text(measurement.id, 180);
		if (!id) return [];
		const landingVisits = optionalMetric(measurement.landingVisits);
		const effectiveReads = optionalMetric(measurement.effectiveReads);
		const metricsPatch = JSON.stringify({
			analyticsStatus: text(measurement.status, 40) || "error",
			analyticsObservedAt: Number(measurement.observedAt || now),
			analyticsErrorCode: text(measurement.errorCode, 120),
		});
		return [
			db
				.prepare(
					`UPDATE growth_campaigns SET
					 landing_visits=COALESCE(?, landing_visits),
					 effective_reads=COALESCE(?, effective_reads),
					 metrics_json=json_patch(metrics_json, ?), updated_at=?
					 WHERE id=? AND status IN ('published','reviewed')`,
				)
				.bind(landingVisits, effectiveReads, metricsPatch, now, id),
		];
	});
	if (statements.length) await db.batch(statements);
	return { updated: statements.length };
}

export async function saveGrowthSnapshot(db, snapshot) {
	const now = Number(snapshot.observedAt || Date.now());
	const id = snapshot.id || crypto.randomUUID();
	await db
		.prepare(
			`INSERT INTO growth_snapshots
			 (id, scope_type, scope_key, source, status, data_json, error_code, observed_at, expires_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			id,
			text(snapshot.scopeType, 40),
			text(snapshot.scopeKey, 500),
			text(snapshot.source, 40),
			GROWTH_SOURCE_STATUSES.has(snapshot.status) ? snapshot.status : "error",
			JSON.stringify(snapshot.data ?? null),
			text(snapshot.errorCode, 120),
			now,
			now + SNAPSHOT_RETENTION_MS,
		)
		.run();
	return id;
}

export async function saveGeneratedTasks(db, tasks, now = Date.now()) {
	const statements = safeArray(tasks, 30).map((task) =>
		db
			.prepare(
				`INSERT INTO growth_tasks
				 (id, topic_slug, post_path, kind, status, priority, title, reason, detail_json, due_at, completed_at, created_at, updated_at)
				 VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, NULL, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET
			 priority=excluded.priority, title=excluded.title, reason=excluded.reason,
			 detail_json=excluded.detail_json, due_at=excluded.due_at,
			 status=CASE WHEN growth_tasks.status='done' THEN 'open' ELSE growth_tasks.status END,
			 completed_at=CASE WHEN growth_tasks.status='done' THEN NULL ELSE growth_tasks.completed_at END,
			 updated_at=excluded.updated_at`,
			)
			.bind(
				task.id,
				text(task.topicSlug, 120),
				text(task.postPath, 500),
				text(task.kind, 80),
				text(task.priority, 20) || "normal",
				text(task.title, 300),
				text(task.reason, 800),
				JSON.stringify(task.detail || {}),
				Number.isFinite(task.dueAt) ? task.dueAt : null,
				now,
				now,
			),
	);
	if (statements.length) await db.batch(statements);
}

export async function opportunisticPrune(db, now = Date.now()) {
	const meta = await db.prepare("SELECT value FROM growth_meta WHERE key='last_pruned_at'").first();
	const lastPrunedAt = Number(meta?.value);
	if (!shouldRunPrune(lastPrunedAt, now)) return { ran: false };
	const { snapshotsBefore, detailsBefore } = retentionCutoffs(now);
	await db.batch([
		db.prepare("DELETE FROM growth_snapshots WHERE expires_at < ? OR observed_at < ?").bind(now, snapshotsBefore),
		db.prepare(
			`INSERT INTO growth_rollups (id, year, dimension_type, dimension_key, metrics_json, created_at, updated_at)
			 SELECT
			   CAST(strftime('%Y', completed_at / 1000, 'unixepoch') AS TEXT) || ':task:' || kind,
			   CAST(strftime('%Y', completed_at / 1000, 'unixepoch') AS INTEGER),
			   'task', kind, json_object('completed', COUNT(*)), ?, ?
			 FROM growth_tasks
			 WHERE status='done' AND completed_at IS NOT NULL AND completed_at < ?
			 GROUP BY strftime('%Y', completed_at / 1000, 'unixepoch'), kind
			 ON CONFLICT(id) DO UPDATE SET metrics_json=excluded.metrics_json, updated_at=excluded.updated_at`,
		).bind(now, now, detailsBefore),
		db.prepare(
			`INSERT INTO growth_rollups (id, year, dimension_type, dimension_key, metrics_json, created_at, updated_at)
			 SELECT
			   CAST(strftime('%Y', COALESCE(published_at, updated_at) / 1000, 'unixepoch') AS TEXT) || ':campaign:' || source,
			   CAST(strftime('%Y', COALESCE(published_at, updated_at) / 1000, 'unixepoch') AS INTEGER),
			   'campaign', source,
			   json_object('campaigns', COUNT(*), 'landing_visits', SUM(landing_visits), 'effective_reads', SUM(effective_reads)), ?, ?
			 FROM growth_campaigns
			 WHERE status IN ('reviewed', 'archived') AND updated_at < ?
			 GROUP BY strftime('%Y', COALESCE(published_at, updated_at) / 1000, 'unixepoch'), source
			 ON CONFLICT(id) DO UPDATE SET metrics_json=excluded.metrics_json, updated_at=excluded.updated_at`,
		).bind(now, now, detailsBefore),
		db.prepare("DELETE FROM growth_tasks WHERE status='done' AND completed_at IS NOT NULL AND completed_at < ?").bind(detailsBefore),
		db.prepare("DELETE FROM growth_campaigns WHERE status IN ('reviewed','archived') AND updated_at < ?").bind(detailsBefore),
		db.prepare(
			"INSERT INTO growth_meta (key, value, updated_at) VALUES ('last_pruned_at', ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
		).bind(String(now), now),
	]);
	return { ran: true, snapshotsBefore, detailsBefore };
}
