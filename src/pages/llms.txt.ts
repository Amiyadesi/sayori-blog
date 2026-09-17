import type { APIRoute } from "astro";

import { profileConfig, siteConfig } from "../config";
import { getTopicUrl, topics } from "../data/topics";
import {
	getSortedPosts,
	isOrdinaryPublicPost,
	isSayoriDiaryPost,
} from "../utils/content-utils";
import { getPostPublicDescription } from "../utils/post-card-content";
import { getPostUrl } from "../utils/url-utils";

export const GET: APIRoute = async () => {
	const posts = (await getSortedPosts()).filter((post) =>
		process.env.SITE_VARIANT === "sayori-diary"
			? isSayoriDiaryPost(post)
			: isOrdinaryPublicPost(post),
	);
	const normalizePostId = (value: string) =>
		value.replace(/\.(md|mdx|markdown)$/i, "").replace(/\/index$/i, "");
	const postById = new Map(
		posts.flatMap((post) => [
			[post.id, post],
			[normalizePostId(post.id), post],
		]),
	);
	const findPublicPost = (id: string, slug: string) =>
		postById.get(id) ??
		postById.get(normalizePostId(id)) ??
		postById.get(slug) ??
		postById.get(normalizePostId(slug));
	const topicLines = topics.flatMap((topic) => {
		const topicUrl = new URL(getTopicUrl(topic), siteConfig.siteURL).href;
		const lines = [
			`- [${topic.title}](${topicUrl}) - ${topic.description}`,
		];

		for (const reference of topic.includedPosts) {
			const post = findPublicPost(reference.id, reference.slug);
			if (!post) {
				continue;
			}
			lines.push(
				`  - [${post.data.title}](${new URL(getPostUrl(post), siteConfig.siteURL).href}) - ${reference.why}`,
			);
		}
		return lines;
	});
	const lines = [
		`# ${siteConfig.title}`,
		"",
		`> ${siteConfig.title} is Amiya_desi's personal blog for Godot game development, websites, tools, self-hosting notes, AI workflows, and creative retrospectives`,
		"",
		"## Context",
		"",
		`- Site: ${siteConfig.siteURL}`,
		`- Owner: ${profileConfig.name}`,
		`- Language: ${siteConfig.lang.replace("_", "-")}`,
		`- Description: ${siteConfig.subtitle}`,
		"- Purpose: personal writing, durable project notes, public tutorials, and long-term records",
		"",
		"This is a personal blog and public knowledge entry point, not a local business or commercial service site",
		"",
		"## Core Links",
		"",
		`- Blog home: ${siteConfig.siteURL}`,
		"- Main desk: https://sayori.org/",
		"- About: https://sayori.org/about/",
		"- GitHub: https://github.com/Amiyadesi",
		"- itch.io: https://amiya-desi.itch.io/",
		"- Bilibili: https://space.bilibili.com/3546919890585725",
		"- Guestbook: https://blog.sayori.org/guestbook/",
		`- RSS: ${new URL("rss.xml", siteConfig.siteURL).href}`,
		`- Sitemap: ${new URL("sitemap.xml", siteConfig.siteURL).href}`,
		"",
		"## Creator Profile",
		"",
		"- Creator: Amiya_desi",
		"- Focus: indie games with Godot, websites, tools, self-hosting, and AI workflows",
		"- Current goal: complete and publish a first Steam game",
		"- Representative work: DelayTrace, TimeRewindLinker, WakeUpAtTheBorder, Mio’s Window Wanderer, GeoScore, and Enhanced Save System",
		"",
		"## Topics",
		"",
		...topicLines,
		"",
		"## Recent Posts",
		"",
		...posts.slice(0, 40).map((post) => {
			const postUrl = new URL(getPostUrl(post), siteConfig.siteURL).href;
			const description = getPostPublicDescription(
				post.data,
				post.data.title,
			);
			return `- [${post.data.title}](${postUrl}) - ${description}`;
		}),
		"",
		"## Crawl Policy",
		"",
		"Search indexing, real-time AI grounding, AI citation, and model training uses are allowed for public content; the canonical sitemap and llms.txt are advertised from the site HTML",
	];

	return new Response(lines.join("\n"), {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
		},
	});
};
