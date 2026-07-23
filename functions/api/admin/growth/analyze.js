import {
	handleError,
	json,
	requireAdmin,
	requireSameOrigin,
} from "../../../_lib/admin.js";
import {
	buildAnalysisTasks,
	ensureGrowthSeeds,
	listGrowthCampaignsForPost,
	normalizeBlogTarget,
	normalizeGrowthQueries,
	saveCampaignMeasurements,
	saveGeneratedTasks,
	saveGrowthSnapshot,
} from "../../../_lib/growth.js";
import {
	defaultAnalysisPeriod,
	runGeoScore,
	runSearchConsole,
	runSearchGateway,
	runUmami,
} from "../../../_lib/growth-adapters.js";

function emit(controller, event, data) {
	controller.enqueue(
		new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
	);
}

async function readBody(request) {
	try {
		return await request.json();
	} catch {
		throw json({ success: false, error: "请求 JSON 无效" }, { status: 400 });
	}
}

export async function onRequestPost(context) {
	try {
		await requireAdmin(context.request, context.env);
		requireSameOrigin(context.request);
		const db = context.env.SAYORI_ANALYTICS_DB;
		if (!db) {
			throw json({ success: false, error: "Cloudflare 缺少 SAYORI_ANALYTICS_DB" }, { status: 503 });
		}
		const body = await readBody(context.request);
		let target;
		try {
			target = normalizeBlogTarget(body.targetUrl);
		} catch (error) {
			throw json({ success: false, error: error.message }, { status: 400 });
		}
		const queries = normalizeGrowthQueries(body.queries, body.title);
		if (!queries.length) {
			throw json({ success: false, error: "至少填写一个真实搜索查询" }, { status: 400 });
		}
		const input = {
			targetUrl: target.toString(),
			title: String(body.title || "").slice(0, 200),
			topicSlug: String(body.topicSlug || "").slice(0, 120),
			locale: String(body.locale || "zh-CN").slice(0, 35),
			queries,
			fresh: body.fresh === true,
		};
		const period = defaultAnalysisPeriod();
		await ensureGrowthSeeds(db);
		const campaigns = await listGrowthCampaignsForPost(db, target.pathname);

		const stream = new ReadableStream({
			start(controller) {
				(async () => {
					emit(controller, "started", {
						targetUrl: input.targetUrl,
						queries,
						period,
					});
					const runners = {
						search_gateway: () => runSearchGateway(input, context.env),
						geoscore: () => runGeoScore(input, context.env),
						umami: () => runUmami({ ...input, ...period, campaigns }, context.env),
						gsc: () => runSearchConsole(input, context.env),
					};
					const results = {};
					await Promise.all(
						Object.entries(runners).map(async ([source, run]) => {
							emit(controller, "stage", { source, status: "running" });
							let result;
							try {
								result = await run();
							} catch {
								result = {
									source,
									status: "error",
									observedAt: Date.now(),
									data: null,
									error: {
										code: "UNEXPECTED_FAILURE",
										message: "数据源执行失败",
										retryable: true,
									},
								};
							}
							results[source] = result;
							try {
								await saveGrowthSnapshot(db, {
									scopeType: "post",
									scopeKey: target.pathname,
									source,
									status: result.status,
									data: result.data,
									errorCode: result.error?.code || "",
									observedAt: result.observedAt,
								});
							} catch {
								emit(controller, "storage", {
									source,
									status: "error",
									message: "证据已返回，但快照保存失败",
								});
							}
							emit(controller, "source", result);
						}),
					);

					const campaignMeasurements = results.umami?.data?.campaignMetrics;
					if (Array.isArray(campaignMeasurements) && campaignMeasurements.length) {
						try {
							await saveCampaignMeasurements(db, campaignMeasurements);
						} catch {
							emit(controller, "storage", {
								source: "umami",
								status: "error",
								message: "Campaign 指标已返回，但回写失败",
							});
						}
					}

					const tasks = buildAnalysisTasks({
						targetUrl: input.targetUrl,
						topicSlug: input.topicSlug,
						results,
					});
					await saveGeneratedTasks(db, tasks);
					emit(controller, "complete", {
						success: true,
						targetUrl: input.targetUrl,
						queries,
						period,
						partial: Object.values(results).some((item) => item.status !== "complete"),
						results,
						tasks,
					});
				})()
					.catch(() => {
						emit(controller, "error", {
							code: "ANALYSIS_FAILED",
							message: "增长分析未能完成",
							retryable: true,
						});
					})
					.finally(() => controller.close());
			},
		});

		return new Response(stream, {
			headers: {
				"content-type": "text/event-stream; charset=utf-8",
				"cache-control": "no-cache, no-transform",
				"x-content-type-options": "nosniff",
			},
		});
	} catch (error) {
		return handleError(error);
	}
}
