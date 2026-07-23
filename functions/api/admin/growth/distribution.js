import { handleError, json, requireAdmin, requireSameOrigin } from "../../../_lib/admin.js";
import { buildDistributionPackage } from "../../../_lib/growth.js";
import { upsertGrowthCampaign } from "../../../_lib/growth-store.js";

export async function onRequestPost(context) {
	try {
		await requireAdmin(context.request, context.env);
		requireSameOrigin(context.request);
		if (!context.env.SAYORI_ANALYTICS_DB) throw json({ success: false, error: "增长数据库未配置" }, { status: 503 });
		const body = await context.request.json();
		let distributionPackage;
		try {
			distributionPackage = buildDistributionPackage(body);
		} catch (error) {
			throw json({ success: false, error: error.message }, { status: 400 });
		}
		const target = new URL(distributionPackage.target_url);
		const campaign = await upsertGrowthCampaign(context.env.SAYORI_ANALYTICS_DB, {
			id: body.campaignId,
			name: body.campaign,
			topicSlug: body.topicSlug,
			postPath: target.pathname,
			status: body.status || "draft",
			source: body.source,
			medium: body.medium,
			content: body.content,
			targetUrl: distributionPackage.target_url,
			metrics: { packageVersion: distributionPackage.version },
		});
		return json({ success: true, campaign, package: distributionPackage });
	} catch (error) {
		return handleError(error);
	}
}
