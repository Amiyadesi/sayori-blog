import {
	createDefaultCampaign,
	normalizeCampaignSource,
} from "../utils/campaign-link";
import { copyTextWithFeedback } from "../utils/copy-feedback";
import { formatGrowthMetric } from "../utils/growth";

interface GrowthPost {
	id: string;
	title: string;
	path: string;
	url: string;
	description: string;
	tags: string[];
	published: string;
}

interface SourceResult {
	source: string;
	status: "complete" | "partial" | "not_configured" | "error";
	observedAt: number;
	data: any;
	error?: { code?: string; message?: string; retryable?: boolean } | null;
}

interface Overview {
	user: { name?: string; login?: string; avatar_url?: string };
	configuration: Record<string, boolean>;
	actions: any[];
	topics: any[];
	channels: any[];
	tasks: any[];
	campaigns: any[];
	snapshots: any[];
}

interface AnalysisState {
	targetUrl: string;
	results: Record<string, SourceResult>;
	tasks: any[];
}

const SOURCE_LABELS: Record<string, string> = {
	search_gateway: "Search Gateway",
	geoscore: "GeoScore",
	umami: "Umami",
	gsc: "Google Search Console",
};

function element<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className?: string,
	text?: string,
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag);
	if (className) node.className = className;
	if (text !== undefined) node.textContent = text;
	return node;
}

function value<T extends Element>(
	root: ParentNode,
	selector: string,
): T {
	const node = root.querySelector<T>(selector);
	if (!node) throw new Error(`Missing growth field: ${selector}`);
	return node;
}

function textLines(input: string, limit = 12): string[] {
	return input
		.split(/\r?\n/)
		.map((item) => item.normalize("NFKC").trim())
		.filter(Boolean)
		.slice(0, limit);
}

function formatNumber(input: unknown): string {
	return formatGrowthMetric(input);
}

function formatPercent(input: unknown): string {
	if (input === null || input === undefined || input === "") return "证据不足";
	const number = Number(input);
	return Number.isFinite(number) ? `${(number * 100).toFixed(1)}%` : "证据不足";
}

function formatDate(input: unknown): string {
	const timestamp = Number(input);
	if (!Number.isFinite(timestamp) || timestamp <= 0) return "未设置";
	return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(timestamp);
}

function statusTone(status: string): string {
	if (status === "complete" || status === "published" || status === "done") return "good";
	if (status === "error" || status === "critical") return "bad";
	return "neutral";
}

function chip(label: string, tone = "neutral") {
	const node = element("span", "growth-chip", label);
	node.dataset.tone = tone;
	return node;
}

function row(
	className: string,
	title: string,
	description: string,
	meta: HTMLElement[] = [],
	actions?: HTMLElement,
) {
	const root = element("div", className);
	const copy = element("div", "growth-row-copy");
	copy.append(element("strong", "", title));
	if (description) copy.append(element("p", "", description));
	if (meta.length) {
		const metaRoot = element("div", "growth-row-meta");
		metaRoot.append(...meta);
		copy.append(metaRoot);
	}
	root.append(copy);
	if (actions) root.append(actions);
	return root;
}

function empty(message: string) {
	return element("p", "growth-empty", message);
}

async function api<T = any>(url: string, init: RequestInit = {}): Promise<T> {
	const response = await fetch(url, {
		credentials: "same-origin",
		headers: {
			accept: "application/json",
			...(init.body ? { "content-type": "application/json" } : {}),
			...(init.headers || {}),
		},
		...init,
	});
	let data: any = null;
	try {
		data = await response.json();
	} catch {
		data = null;
	}
	if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
	return data;
}

async function readSse(
	response: Response,
	onEvent: (event: string, data: any) => void,
) {
	if (!response.body) throw new Error("浏览器没有收到分析流");
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	const consume = (block: string) => {
		if (!block.trim() || block.trimStart().startsWith(":")) return;
		let event = "message";
		const data: string[] = [];
		for (const line of block.split(/\r?\n/)) {
			if (line.startsWith("event:")) event = line.slice(6).trim();
			if (line.startsWith("data:")) data.push(line.slice(5).trim());
		}
		if (!data.length) return;
		let payload: any;
		try {
			payload = JSON.parse(data.join("\n"));
		} catch {
			// A broken event should not hide later successful sources.
			return;
		}
		onEvent(event, payload);
	};

	while (true) {
		const { value: chunk, done } = await reader.read();
		buffer += decoder.decode(chunk || new Uint8Array(), { stream: !done });
		const blocks = buffer.split(/\r?\n\r?\n/);
		buffer = blocks.pop() || "";
		for (const block of blocks) consume(block);
		if (done) break;
	}
	if (buffer.trim()) consume(buffer);
}

function initGrowthWorkbench() {
	document
		.querySelectorAll<HTMLElement>("[data-growth-workbench]")
		.forEach((root) => {
			if (root.dataset.bound === "true") return;
			root.dataset.bound = "true";

			const login = value<HTMLElement>(root, "[data-growth-login]");
			const app = value<HTMLElement>(root, "[data-growth-app]");
			const postScript = value<HTMLScriptElement>(root, "[data-growth-posts]");
			const posts = JSON.parse(postScript.textContent || "[]") as GrowthPost[];
			const postByUrl = new Map(posts.map((post) => [post.url, post]));
			let overview: Overview | null = null;
			let latestAnalysis: AnalysisState | null = null;

			const el = {
				avatar: value<HTMLImageElement>(root, "[data-growth-avatar]"),
				userName: value<HTMLElement>(root, "[data-growth-user-name]"),
				refresh: value<HTMLButtonElement>(root, "[data-growth-refresh]"),
				overviewStatus: value<HTMLElement>(root, "[data-growth-overview-status]"),
				actions: value<HTMLOListElement>(root, "[data-growth-actions]"),
				analysisForm: value<HTMLFormElement>(root, "[data-growth-analysis-form]"),
				postSelect: value<HTMLSelectElement>(root, "[data-growth-post-select]"),
				target: value<HTMLInputElement>(root, "[data-growth-target]"),
				topicSelect: value<HTMLSelectElement>(root, "[data-growth-topic-select]"),
				queries: value<HTMLTextAreaElement>(root, "[data-growth-queries]"),
				fresh: value<HTMLInputElement>(root, "[data-growth-fresh]"),
				analyzeButton: value<HTMLButtonElement>(root, "[data-growth-analyze]"),
				analysisStatus: value<HTMLElement>(root, "[data-growth-analysis-status]"),
				sourceResults: value<HTMLElement>(root, "[data-growth-source-results]"),
				tasks: value<HTMLElement>(root, "[data-growth-tasks]"),
				topics: value<HTMLElement>(root, "[data-growth-topics]"),
				channels: value<HTMLElement>(root, "[data-growth-channels]"),
				campaigns: value<HTMLElement>(root, "[data-growth-campaigns]"),
				distributionForm: value<HTMLFormElement>(root, "[data-growth-distribution-form]"),
				distributionPost: value<HTMLSelectElement>(root, "[data-distribution-post]"),
				distributionChannel: value<HTMLSelectElement>(root, "[data-distribution-channel]"),
				distributionSource: value<HTMLInputElement>(root, "[data-distribution-source]"),
				distributionMedium: value<HTMLSelectElement>(root, "[data-distribution-medium]"),
				distributionCampaign: value<HTMLInputElement>(root, "[data-distribution-campaign]"),
				distributionContent: value<HTMLInputElement>(root, "[data-distribution-content]"),
				distributionFacts: value<HTMLTextAreaElement>(root, "[data-distribution-facts]"),
				distributionEvidence: value<HTMLTextAreaElement>(root, "[data-distribution-evidence]"),
				distributionQuestions: value<HTMLTextAreaElement>(root, "[data-distribution-questions]"),
				distributionStatus: value<HTMLElement>(root, "[data-distribution-status]"),
				distributionOutput: value<HTMLElement>(root, "[data-distribution-output]"),
				distributionUrl: value<HTMLInputElement>(root, "[data-distribution-url]"),
				distributionMarkdown: value<HTMLTextAreaElement>(root, "[data-distribution-markdown]"),
				distributionCopyLink: value<HTMLButtonElement>(root, "[data-distribution-copy-link]"),
				distributionCopyPackage: value<HTMLButtonElement>(root, "[data-distribution-copy-package]"),
				channelForm: value<HTMLFormElement>(root, "[data-growth-channel-form]"),
				channelName: value<HTMLInputElement>(root, "[data-channel-name]"),
				channelSource: value<HTMLInputElement>(root, "[data-channel-source]"),
				channelMedium: value<HTMLSelectElement>(root, "[data-channel-medium]"),
				channelUrl: value<HTMLInputElement>(root, "[data-channel-url]"),
				channelAudience: value<HTMLTextAreaElement>(root, "[data-channel-audience]"),
				channelRules: value<HTMLTextAreaElement>(root, "[data-channel-rules]"),
				channelContent: value<HTMLTextAreaElement>(root, "[data-channel-content]"),
				channelStatus: value<HTMLElement>(root, "[data-channel-status]"),
			};

			function setSourceState(source: string, status: string) {
				const node = root.querySelector<HTMLElement>(`[data-source-state="${source}"]`);
				if (!node) return;
				node.dataset.status = status;
				const label = SOURCE_LABELS[source] || source;
				node.textContent = `${label}: ${status === "not_configured" ? "未配置" : status}`;
			}

			function selectedPost(select = el.postSelect): GrowthPost | undefined {
				return postByUrl.get(select.value);
			}

			function defaultQueries(post?: GrowthPost) {
				if (!post) return "";
				const compactTitle = post.title.replace(/[：:|｜].*$/, "").trim();
				return [compactTitle, `${compactTitle} 教程`, `${compactTitle} 经验`].join("\n");
			}

			function syncSelectedPost(forceQueries = false) {
				const post = selectedPost();
				if (!post) return;
				el.target.value = post.url;
				el.distributionPost.value = post.url;
				if (forceQueries || !el.queries.value.trim()) el.queries.value = defaultQueries(post);
				el.distributionCampaign.value = createDefaultCampaign(post.url);
			}

			function showSection(selector: string) {
				root.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
			}

			function renderActions() {
				const actions = overview?.actions || [];
				if (!actions.length) {
					el.actions.replaceChildren(empty("当前没有待办动作"));
					return;
				}
				el.actions.replaceChildren(
					...actions.map((action: any, index: number) => {
						const button = element("button", "", "处理");
						button.type = "button";
						button.addEventListener("click", () => {
							if (action.type === "review_topic") showSection("[data-growth-topics]");
							else if (action.type === "channel") showSection("[data-growth-channel-form]");
							else if (action.type === "task") showSection("[data-growth-tasks]");
							else if (action.type === "review_campaign") showSection("[data-growth-campaigns]");
							else showSection("[data-growth-analysis-form]");
						});
						const actionsRoot = element("div", "growth-row-actions");
						actionsRoot.append(button);
						return row(
							"growth-action",
							`${index + 1}. ${action.title}`,
							action.reason || "",
							[chip(action.priority || "normal", action.priority === "high" ? "bad" : "neutral")],
							actionsRoot,
						);
					}),
				);
			}

			function renderTopics() {
				const topics = overview?.topics || [];
				el.topicSelect.replaceChildren(element("option", "", "暂不关联专题"));
				(el.topicSelect.firstElementChild as HTMLOptionElement).value = "";
				for (const topic of topics) {
					const option = element("option", "", topic.title);
					option.value = topic.slug;
					el.topicSelect.append(option);
				}
				if (!topics.length) {
					el.topics.replaceChildren(empty("没有专题草稿"));
					return;
				}
				el.topics.replaceChildren(
					...topics.map((topic: any) => {
						const select = element("select");
						for (const status of ["candidate", "draft", "published", "archived"]) {
							const option = element("option", "", status);
							option.value = status;
							option.selected = status === topic.status;
							select.append(option);
						}
						const save = element("button", "", "保存状态");
						save.type = "button";
						save.addEventListener("click", async () => {
							save.disabled = true;
							try {
								await api("/api/admin/growth/topics", {
									method: "POST",
									body: JSON.stringify({ ...topic, status: select.value }),
								});
								await loadOverview();
							} catch (error) {
								el.overviewStatus.textContent = (error as Error).message;
							} finally {
								save.disabled = false;
							}
						});
						const actions = element("div", "growth-row-actions");
						actions.append(select, save);
						const evidence = Array.isArray(topic.evidence) ? topic.evidence : [];
						const description = evidence.slice(0, 2).join("；") || "尚未记录专题证据";
						const topicRow = row(
							"growth-topic",
							topic.title,
							description,
							[
								chip(topic.status, statusTone(topic.status)),
								chip(`${topic.articlePaths?.length || 0} 篇文章`),
								chip(`${evidence.length} 条证据`),
							],
							actions,
						);
						const details = element("details", "growth-topic-details");
						details.append(element("summary", "", "查看草稿证据与里程碑"));
						const draft = topic.draft && typeof topic.draft === "object" ? topic.draft : {};
						const groups = [
							["受众", topic.audience],
							["阅读路径", draft.startingPath],
							["作品入口", (draft.works || []).map((item: any) => `${item.label} · ${item.url}`)],
							["内容缺口", draft.contentGaps],
							["问答", draft.questions],
						];
						for (const [label, values] of groups) {
							if (!Array.isArray(values) || values.length === 0) continue;
							const heading = element("strong", "", String(label));
							const list = element("ul");
							for (const item of values.slice(0, 8)) list.append(element("li", "", String(item)));
							details.append(heading, list);
						}
						if (topic.slug === "game-development") {
							const milestone = element("div", "growth-milestone-form");
							const date = element("input");
							date.type = "date";
							if (Number.isFinite(Number(draft.lastMilestoneAt))) {
								date.value = new Date(Number(draft.lastMilestoneAt)).toISOString().slice(0, 10);
							}
							const label = element("input");
							label.type = "text";
							label.placeholder = "里程碑，例如发布试玩版";
							label.value = String(draft.lastMilestoneLabel || "");
							const record = element("button", "", "记录里程碑");
							record.type = "button";
							record.addEventListener("click", async () => {
								if (!date.value) {
									el.overviewStatus.textContent = "请选择可核验的里程碑日期";
									return;
								}
								record.disabled = true;
								try {
									await api("/api/admin/growth/topics", {
										method: "POST",
										body: JSON.stringify({
											...topic,
											draft: {
												...draft,
												lastMilestoneAt: new Date(`${date.value}T00:00:00Z`).getTime(),
												lastMilestoneLabel: label.value.trim(),
											},
										}),
									});
									await loadOverview();
								} catch (error) {
									el.overviewStatus.textContent = (error as Error).message;
								} finally {
									record.disabled = false;
								}
							});
							milestone.append(date, label, record);
							details.append(milestone);
						}
						topicRow.querySelector(".growth-row-copy")?.append(details);
						return topicRow;
					}),
				);
			}

			function renderTasks() {
				const tasks = overview?.tasks || [];
				if (!tasks.length) {
					el.tasks.replaceChildren(empty("运行文章分析后，真实失败项会出现在这里"));
					return;
				}
				el.tasks.replaceChildren(
					...tasks.map((task: any) => {
						const select = element("select");
						for (const status of ["open", "doing", "done", "archived"]) {
							const option = element("option", "", status);
							option.value = status;
							option.selected = status === task.status;
							select.append(option);
						}
						const save = element("button", "", "更新");
						save.type = "button";
						save.addEventListener("click", async () => {
							save.disabled = true;
							try {
								await api("/api/admin/growth/tasks", {
									method: "POST",
									body: JSON.stringify({ id: task.id, status: select.value }),
								});
								await loadOverview();
							} finally {
								save.disabled = false;
							}
						});
						const actions = element("div", "growth-row-actions");
						actions.append(select, save);
						return row(
							"growth-task",
							task.title,
							task.reason,
							[
								chip(task.priority, statusTone(task.priority)),
								chip(task.kind),
								chip(task.post_path || "无页面"),
							],
							actions,
						);
					}),
				);
			}

			function renderChannels() {
				const channels = overview?.channels || [];
				el.distributionChannel.replaceChildren(element("option", "", "自定义渠道"));
				(el.distributionChannel.firstElementChild as HTMLOptionElement).value = "";
				for (const channel of channels) {
					const option = element("option", "", channel.name);
					option.value = channel.id;
					el.distributionChannel.append(option);
				}
				if (!channels.length) {
					el.channels.replaceChildren(empty("还没有渠道档案"));
					return;
				}
				el.channels.replaceChildren(
					...channels.map((channel: any) => {
						const use = element("button", "", "用于分发包");
						use.type = "button";
						use.addEventListener("click", () => {
							el.distributionChannel.value = channel.id;
							applyChannel(channel);
							showSection("[data-growth-distribution-form]");
						});
						const remove = element("button", "", "删除");
						remove.type = "button";
						remove.addEventListener("click", async () => {
							if (!window.confirm(`删除渠道档案「${channel.name}」？`)) return;
							await api("/api/admin/growth/channels", {
								method: "DELETE",
								body: JSON.stringify({ id: channel.id }),
							});
							await loadOverview();
						});
						const actions = element("div", "growth-row-actions");
						actions.append(use, remove);
						return row(
							"growth-channel",
							channel.name,
							[channel.audience, channel.rules].filter(Boolean).join("；") || "未补充渠道规则",
							[chip(channel.source), chip(channel.medium)],
							actions,
						);
					}),
				);
			}

			function renderCampaigns() {
				const campaigns = overview?.campaigns || [];
				if (!campaigns.length) {
					el.campaigns.replaceChildren(empty("生成分发证据包后会建立 Campaign 草稿"));
					return;
				}
				el.campaigns.replaceChildren(
					...campaigns.map((campaign: any) => {
						const visits = Number(campaign.landingVisits || 0);
						const reads = Number(campaign.effectiveReads || 0);
						const evidenceState = visits >= 20 ? `${formatPercent(reads / visits)} 有效阅读率` : "证据不足";
						const select = element("select");
						for (const status of ["draft", "published", "reviewed", "archived"]) {
							const option = element("option", "", status);
							option.value = status;
							option.selected = status === campaign.status;
							select.append(option);
						}
						const save = element("button", "", "更新");
						save.type = "button";
						save.addEventListener("click", async () => {
							await api("/api/admin/growth/campaigns", {
								method: "POST",
								body: JSON.stringify({
									id: campaign.id,
									name: campaign.name,
									topicSlug: campaign.topicSlug,
									postPath: campaign.postPath,
									status: select.value,
									source: campaign.source,
									medium: campaign.medium,
									content: campaign.content,
									targetUrl: campaign.targetUrl,
									landingVisits: visits,
									effectiveReads: reads,
									publishedAt: campaign.publishedAt,
									reviewDueAt: campaign.reviewDueAt,
									metrics: campaign.metrics,
								}),
							});
							await loadOverview();
						});
						const actions = element("div", "growth-row-actions");
						actions.append(select, save);
						return row(
							"growth-campaign",
							campaign.name,
							`${campaign.source} / ${campaign.medium} · 复盘日 ${formatDate(campaign.reviewDueAt)}`,
							[
								chip(campaign.status, statusTone(campaign.status)),
								chip(`${formatNumber(visits)} 落地`),
								chip(`${formatNumber(reads)} 有效阅读`),
								chip(evidenceState, visits >= 20 ? "good" : "neutral"),
							],
							actions,
						);
					}),
				);
			}

			function renderOverview() {
				if (!overview) return;
				el.userName.textContent = overview.user.name || overview.user.login || "Amiya";
				if (overview.user.avatar_url) el.avatar.src = overview.user.avatar_url;
				for (const source of Object.keys(SOURCE_LABELS)) {
					setSourceState(source, overview.configuration[source] ? "ready" : "not_configured");
				}
				renderActions();
				renderTopics();
				renderTasks();
				renderChannels();
				renderCampaigns();
				el.overviewStatus.textContent = `已读取 ${overview.snapshots.length} 个近期快照`;
			}

			async function loadOverview() {
				el.overviewStatus.textContent = "正在读取工作台状态";
				try {
					overview = await api<Overview>("/api/admin/growth/overview");
					login.hidden = true;
					app.hidden = false;
					renderOverview();
				} catch (error) {
					if ((error as Error).message.includes("登录")) {
						app.hidden = true;
						login.hidden = false;
						return;
					}
					login.hidden = true;
					app.hidden = false;
					el.overviewStatus.textContent = (error as Error).message;
				}
			}

			function sourceSummary(result: SourceResult) {
				const card = element("section", "growth-source-result");
				const heading = element("h3", "", `${SOURCE_LABELS[result.source] || result.source} · ${result.status}`);
				card.append(heading);
				if (result.error?.message) card.append(element("p", "", result.error.message));
				if (!result.data) return card;

				const list = element("ul");
				if (result.source === "search_gateway") {
					list.append(element("li", "", `${result.data.results?.length || 0} 条带出处搜索证据`));
					for (const item of (result.data.results || []).slice(0, 5)) {
						list.append(element("li", "", `${item.title || item.domain} · ${item.url}`));
					}
				} else if (result.source === "geoscore") {
					list.append(element("li", "", `Overall ${result.data.overallScore ?? "证据不足"} · SEO ${result.data.seoScore ?? "证据不足"} · GEO ${result.data.geoScore ?? "证据不足"}`));
					for (const failure of (result.data.failures || []).slice(0, 8)) {
						list.append(element("li", "", `${failure.severity} · ${failure.title} · ${failure.evidence?.[0] || "查看审计证据"}`));
					}
				} else if (result.source === "umami") {
					list.append(element("li", "", `目标页落地 ${formatNumber(result.data.landingPageviews)} · 有效阅读 ${formatNumber(result.data.effectiveReads)}`));
					for (const item of (result.data.sources || []).slice(0, 5)) {
						list.append(element("li", "", `${item.key || "未知来源"} · ${formatNumber(item.value)}`));
					}
				} else if (result.source === "gsc") {
					list.append(element("li", "", `${result.data.current?.length || 0} 个查询 · ${result.data.opportunities?.length || 0} 个达标机会`));
					for (const item of (result.data.opportunities || []).slice(0, 8)) {
						list.append(element("li", "", `${item.query} · ${item.impressions} 展示 · 排名 ${Number(item.position).toFixed(1)} · CTR ${formatPercent(item.ctr)}`));
					}
				}
				if (list.childElementCount) card.append(list);
				return card;
			}

			function renderSourceResults() {
				const results = latestAnalysis?.results || {};
				const nodes = Object.keys(SOURCE_LABELS)
					.map((source) => results[source])
					.filter(Boolean)
					.map(sourceSummary);
				el.sourceResults.hidden = nodes.length === 0;
				el.sourceResults.replaceChildren(...nodes);
			}

			function evidenceFromAnalysis(): string[] {
				if (!latestAnalysis) return [];
				const lines: string[] = [];
				const search = latestAnalysis.results.search_gateway;
				for (const item of (search?.data?.results || []).slice(0, 5)) {
					lines.push(`搜索证据：${item.title || item.domain} · ${item.url}`);
				}
				const geo = latestAnalysis.results.geoscore;
				if (geo?.status === "complete") {
					lines.push(`GeoScore ${geo.data.scoreVersion || ""}：Overall ${geo.data.overallScore ?? "证据不足"}`);
					for (const failure of (geo.data.failures || []).slice(0, 5)) {
						lines.push(`GeoScore 失败：${failure.title} · ${failure.evidence?.[0] || failure.id}`);
					}
				}
				const umami = latestAnalysis.results.umami;
				if (umami?.data) {
					lines.push(`Umami：目标页落地 ${formatNumber(umami.data.landingPageviews)}，有效阅读 ${formatNumber(umami.data.effectiveReads)}`);
				}
				const gsc = latestAnalysis.results.gsc;
				for (const item of (gsc?.data?.opportunities || []).slice(0, 5)) {
					lines.push(`GSC：${item.query} · ${item.impressions} 展示 · 排名 ${Number(item.position).toFixed(1)} · CTR ${formatPercent(item.ctr)}`);
				}
				return lines;
			}

			async function runAnalysis(event: SubmitEvent) {
				event.preventDefault();
				const post = selectedPost();
				const queries = textLines(el.queries.value, 3);
				if (!post || !queries.length) {
					el.analysisStatus.textContent = "请选择文章并填写至少一个搜索查询";
					return;
				}
				el.analyzeButton.disabled = true;
				el.analysisStatus.textContent = "四个来源正在并行分析";
				latestAnalysis = { targetUrl: el.target.value, results: {}, tasks: [] };
				renderSourceResults();
				for (const source of Object.keys(SOURCE_LABELS)) setSourceState(source, "waiting");
				try {
					const response = await fetch("/api/admin/growth/analyze", {
						method: "POST",
						credentials: "same-origin",
						headers: { accept: "text/event-stream", "content-type": "application/json" },
						body: JSON.stringify({
							targetUrl: el.target.value,
							title: post.title,
							topicSlug: el.topicSelect.value,
							queries,
							locale: document.documentElement.lang || "zh-CN",
							fresh: el.fresh.checked,
						}),
					});
					if (!response.ok) {
						const failure = await response.json().catch(() => null);
						throw new Error(failure?.error || `HTTP ${response.status}`);
					}
					await readSse(response, (eventName, data) => {
						if (eventName === "stage") setSourceState(data.source, data.status);
						if (eventName === "source") {
							latestAnalysis!.results[data.source] = data;
							setSourceState(data.source, data.status);
							renderSourceResults();
						}
						if (eventName === "complete") {
							latestAnalysis = {
								targetUrl: data.targetUrl,
								results: data.results,
								tasks: data.tasks,
							};
							el.analysisStatus.textContent = data.partial
								? "分析完成，部分来源未配置或失败"
								: "四个来源分析完成";
							el.distributionEvidence.value = evidenceFromAnalysis().join("\n");
							renderSourceResults();
						}
						if (eventName === "error") throw new Error(data.message || "分析失败");
					});
					await loadOverview();
				} catch (error) {
					el.analysisStatus.textContent = (error as Error).message;
				} finally {
					el.analyzeButton.disabled = false;
				}
			}

			function applyChannel(channel: any) {
				el.distributionSource.value = channel?.source || "";
				el.distributionMedium.value = channel?.medium || "community";
			}

			function packageMarkdown(pack: any) {
				return [
					"# 分发证据包",
					"",
					`- 目标：${pack.target_url}`,
					`- 渠道：${pack.channel.name} / ${pack.channel.medium}`,
					`- 受众：${pack.channel.audience || "待补"}`,
					"",
					"## 可核验事实",
					...(pack.facts.length ? pack.facts.map((item: string) => `- ${item}`) : ["- 待补，发布前必须有事实"]),
					"",
					"## 证据与出处",
					...(pack.evidence.length ? pack.evidence.map((item: string) => `- ${item}`) : ["- 待补，发布前必须有出处"]),
					"",
					"## 渠道结构",
					...pack.structure.map((item: string) => `- ${item}`),
					"",
					"## 讨论问题",
					...(pack.discussion_questions.length ? pack.discussion_questions.map((item: string) => `- ${item}`) : ["- 待补一个具体问题"]),
					"",
					"## 发布前检查",
					...pack.preflight.map((item: string) => `- [ ] ${item}`),
					"",
					"## 七天复盘",
					`- 少于 ${pack.review.minimum_landing_visits} 次落地访问只标记证据不足`,
					`- 首要指标：${pack.review.primary_metric}`,
					`- 质量指标：${pack.review.quality_metric}`,
					"",
					"## 给写作 AI 的约束提示",
					"不要自动发布，也不要把同一段宣传文复制到多个平台",
					"",
					"```text",
					pack.handoff_prompt,
					"```",
				].join("\n");
			}

			async function generateDistribution(event: SubmitEvent) {
				event.preventDefault();
				const channel = overview?.channels.find((item) => item.id === el.distributionChannel.value);
				const post = postByUrl.get(el.distributionPost.value);
				el.distributionStatus.textContent = "正在生成证据包";
				try {
					const data = await api("/api/admin/growth/distribution", {
						method: "POST",
						body: JSON.stringify({
							target_url: el.distributionPost.value,
							topicSlug: el.topicSelect.value,
							source: normalizeCampaignSource(el.distributionSource.value),
							medium: el.distributionMedium.value,
							campaign: el.distributionCampaign.value,
							content: el.distributionContent.value,
							channel_name: channel?.name || el.distributionSource.value,
							channel_audience: channel?.audience || "",
							channel_rules: channel?.rules || "",
							facts: textLines(el.distributionFacts.value, 8),
							evidence: textLines(el.distributionEvidence.value, 12),
							discussion_questions: textLines(el.distributionQuestions.value, 5),
							status: "draft",
							postTitle: post?.title || "",
						}),
					});
					el.distributionUrl.value = data.package.target_url;
					el.distributionMarkdown.value = packageMarkdown(data.package);
					el.distributionOutput.hidden = false;
					el.distributionStatus.textContent = "证据包已生成并保存为 Campaign 草稿";
					await loadOverview();
				} catch (error) {
					el.distributionStatus.textContent = (error as Error).message;
				}
			}

			async function saveChannel(event: SubmitEvent) {
				event.preventDefault();
				el.channelStatus.textContent = "正在保存";
				try {
					await api("/api/admin/growth/channels", {
						method: "POST",
						body: JSON.stringify({
							name: el.channelName.value,
							source: normalizeCampaignSource(el.channelSource.value),
							medium: el.channelMedium.value,
							entryUrl: el.channelUrl.value,
							audience: el.channelAudience.value,
							rules: el.channelRules.value,
							suitableContent: el.channelContent.value,
						}),
					});
					el.channelForm.reset();
					el.channelStatus.textContent = "渠道已保存";
					await loadOverview();
				} catch (error) {
					el.channelStatus.textContent = (error as Error).message;
				}
			}

			el.postSelect.addEventListener("change", () => syncSelectedPost(true));
			el.distributionPost.addEventListener("change", () => {
				el.distributionCampaign.value = createDefaultCampaign(el.distributionPost.value);
			});
			el.distributionChannel.addEventListener("change", () => {
				applyChannel(overview?.channels.find((item) => item.id === el.distributionChannel.value));
			});
			el.analysisForm.addEventListener("submit", runAnalysis);
			el.distributionForm.addEventListener("submit", generateDistribution);
			el.channelForm.addEventListener("submit", saveChannel);
			el.refresh.addEventListener("click", () => void loadOverview());
			el.distributionCopyLink.addEventListener("click", () => void copyTextWithFeedback(el.distributionUrl.value));
			el.distributionCopyPackage.addEventListener("click", () => void copyTextWithFeedback(el.distributionMarkdown.value));

			const normalizePath = (path: string) =>
				path.length > 1 ? path.replace(/\/+$/, "") : path;
			const requestedPath = new URLSearchParams(window.location.search).get("post");
			if (requestedPath) {
				const matching = posts.find(
					(post) => normalizePath(post.path) === normalizePath(requestedPath),
				);
				if (matching) el.postSelect.value = matching.url;
			}
			syncSelectedPost(true);
			void loadOverview();
		});
}

initGrowthWorkbench();
document.addEventListener("swup:pageView", initGrowthWorkbench);
