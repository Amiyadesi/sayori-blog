import { GROWTH_MEDIA, GROWTH_TOPIC_STATUSES } from "./growth.js";

function text(value, limit = 500) {
	return String(value || "").normalize("NFKC").trim().slice(0, limit);
}

function stringArray(value, limit = 50) {
	return Array.isArray(value)
		? value.slice(0, limit).map((item) => text(item, 500)).filter(Boolean)
		: [];
}

function optionalPositiveNumber(value) {
	if (value === null || value === undefined || value === "") return null;
	const number = Number(value);
	return Number.isFinite(number) && number > 0 ? number : null;
}

export async function upsertGrowthTopic(db, input, now = Date.now()) {
	const slug = text(input.slug, 120).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
	const title = text(input.title, 200);
	const status = text(input.status, 30);
	if (!slug || !title || !GROWTH_TOPIC_STATUSES.has(status)) {
		throw new Error("专题需要有效的 slug、标题和状态");
	}
	const id = text(input.id, 180) || `topic:${slug}`;
	const draft = input.draft && typeof input.draft === "object" ? input.draft : {};
	const draftJson = JSON.stringify(draft);
	if (draftJson.length > 24_000) {
		throw new Error("专题草稿过大，请精简后再保存");
	}
	await db.prepare(
		`INSERT INTO growth_topics
		 (id, slug, title, status, priority, audience_json, article_paths_json, evidence_json, draft_json, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(slug) DO UPDATE SET
		 title=excluded.title, status=excluded.status, priority=excluded.priority,
		 audience_json=excluded.audience_json, article_paths_json=excluded.article_paths_json,
		 evidence_json=excluded.evidence_json, draft_json=excluded.draft_json, updated_at=excluded.updated_at`,
	).bind(
		id,
		slug,
		title,
		status,
		Math.max(0, Math.min(100, Number(input.priority || 0))),
		JSON.stringify(stringArray(input.audience, 20)),
		JSON.stringify(stringArray(input.articlePaths, 80)),
		JSON.stringify(stringArray(input.evidence, 80)),
		draftJson,
		now,
		now,
	).run();
	return { id, slug, title, status, updatedAt: now };
}

export async function upsertGrowthChannel(db, input, now = Date.now()) {
	const name = text(input.name, 160);
	const source = text(input.source, 120);
	const medium = text(input.medium, 40);
	if (!name || !source || !GROWTH_MEDIA.has(medium)) {
		throw new Error("渠道需要名称、source 和有效 medium");
	}
	let entryUrl = text(input.entryUrl, 2048);
	if (entryUrl) {
		const url = new URL(entryUrl);
		if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("渠道入口必须是 HTTP(S) URL");
		entryUrl = url.toString();
	}
	const id = text(input.id, 180) || `channel:${crypto.randomUUID()}`;
	await db.prepare(
		`INSERT INTO growth_channels
		 (id, name, source, medium, entry_url, audience, rules, suitable_content, last_published_at, metrics_json, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET
		 name=excluded.name, source=excluded.source, medium=excluded.medium,
		 entry_url=excluded.entry_url, audience=excluded.audience, rules=excluded.rules,
		 suitable_content=excluded.suitable_content, last_published_at=excluded.last_published_at,
		 metrics_json=excluded.metrics_json, updated_at=excluded.updated_at`,
	).bind(
		id,
		name,
		source,
		medium,
		entryUrl,
		text(input.audience, 1200),
		text(input.rules, 2400),
		text(input.suitableContent, 1200),
		optionalPositiveNumber(input.lastPublishedAt),
		JSON.stringify(input.metrics && typeof input.metrics === "object" ? input.metrics : {}),
		now,
		now,
	).run();
	return { id, name, source, medium, updatedAt: now };
}

export async function deleteGrowthChannel(db, id) {
	const channelId = text(id, 180);
	if (!channelId) throw new Error("缺少渠道 ID");
	await db.prepare("DELETE FROM growth_channels WHERE id=?").bind(channelId).run();
	return { id: channelId, deleted: true };
}

export async function updateGrowthTask(db, input, now = Date.now()) {
	const id = text(input.id, 220);
	const status = text(input.status, 30);
	if (!id || !new Set(["open", "doing", "done", "archived"]).has(status)) {
		throw new Error("任务需要有效的 ID 和状态");
	}
	const completedAt = status === "done" ? now : null;
	const result = await db.prepare(
		"UPDATE growth_tasks SET status=?, completed_at=?, updated_at=? WHERE id=?",
	).bind(status, completedAt, now, id).run();
	if (!result.meta?.changes) throw new Error("任务不存在");
	return { id, status, completedAt, updatedAt: now };
}

export async function upsertGrowthCampaign(db, input, now = Date.now()) {
	const name = text(input.name, 160);
	const source = text(input.source, 120);
	const medium = text(input.medium, 40);
	const targetUrl = text(input.targetUrl, 2048);
	const status = text(input.status, 30) || "draft";
	if (!name || !source || !GROWTH_MEDIA.has(medium) || !targetUrl || !new Set(["draft", "published", "reviewed", "archived"]).has(status)) {
		throw new Error("Campaign 配置无效");
	}
	const id = text(input.id, 180) || `campaign:${crypto.randomUUID()}`;
	const providedPublishedAt = optionalPositiveNumber(input.publishedAt);
	const publishedAt = providedPublishedAt
		? providedPublishedAt
		: status === "published"
			? now
			: null;
	const providedReviewDueAt = optionalPositiveNumber(input.reviewDueAt);
	const reviewDueAt = providedReviewDueAt
		? providedReviewDueAt
		: publishedAt
			? publishedAt + 7 * 86_400_000
			: null;
	await db.prepare(
		`INSERT INTO growth_campaigns
		 (id, name, topic_slug, post_path, status, source, medium, content, target_url,
		  landing_visits, effective_reads, published_at, review_due_at, metrics_json, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET
		 name=excluded.name, topic_slug=excluded.topic_slug, post_path=excluded.post_path,
		 status=excluded.status, source=excluded.source, medium=excluded.medium,
		 content=excluded.content, target_url=excluded.target_url,
		 landing_visits=excluded.landing_visits, effective_reads=excluded.effective_reads,
		 published_at=excluded.published_at, review_due_at=excluded.review_due_at,
		 metrics_json=excluded.metrics_json, updated_at=excluded.updated_at`,
	).bind(
		id,
		name,
		text(input.topicSlug, 120),
		text(input.postPath, 500),
		status,
		source,
		medium,
		text(input.content, 120),
		targetUrl,
		Math.max(0, Number(input.landingVisits || 0)),
		Math.max(0, Number(input.effectiveReads || 0)),
		publishedAt,
		reviewDueAt,
		JSON.stringify(input.metrics && typeof input.metrics === "object" ? input.metrics : {}),
		now,
		now,
	).run();
	return { id, name, status, publishedAt, reviewDueAt, updatedAt: now };
}
