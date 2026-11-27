import type { RSSFeedItem } from "@astrojs/rss";
import rss from "@astrojs/rss";
import type { APIContext } from "astro";

import { siteConfig } from "@/config";
import { getSortedPosts } from "@/utils/content-utils";
import {
	buildGardenCatalog,
	getStageLabel,
	getTopicCopy,
	GARDEN_TOPICS,
} from "@/utils/garden-utils";

export async function GET(context: APIContext) {
	if (!context.site) {
		throw new Error("site not set");
	}

	const catalog = buildGardenCatalog(await getSortedPosts());
	// A garden feed follows tending time, not first publication.
	const nodes = catalog.allNodes
		.filter((node) => !node.archived)
		.sort((a, b) => b.lastTended.getTime() - a.lastTended.getTime());

	const items: RSSFeedItem[] = nodes.map((node) => {
		const stage = getStageLabel(node.stage);
		const topic = GARDEN_TOPICS.find((item) => item.id === node.topicId);
		const topicTitle = topic ? getTopicCopy(topic).title : "";
		const badge = [stage.icon, topicTitle].filter(Boolean).join(" ");
		return {
			title: `${badge ? `[${badge}] ` : ""}${node.title}`,
			description: node.description,
			pubDate: node.lastTended,
			link: new URL(node.url, context.site).href,
			categories: [topicTitle, stage.name].filter(Boolean),
		};
	});

	return rss({
		title: `${siteConfig.title} · Garden`,
		description:
			siteConfig.lang.startsWith("en")
				? "Notes in the garden, ordered by the last time they were tended rather than by publication date."
				: "花园里的笔记，按最近一次修剪的时间排序，而不是按首次发布时间。",
		site: context.site,
		items,
		customData: `<language>${siteConfig.lang}</language>`,
	});
}
