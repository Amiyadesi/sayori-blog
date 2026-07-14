import type { APIRoute } from "astro";

import { profileConfig, siteConfig } from "../config";
import { getTopicUrl, topics } from "../data/topics";
import { getSortedPosts, isOrdinaryPublicPost } from "../utils/content-utils";
import { getPostPublicDescription } from "../utils/post-card-content";
import { getPostUrl } from "../utils/url-utils";

export const GET: APIRoute = async () => {
	const posts = (await getSortedPosts()).filter(isOrdinaryPublicPost);
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
		`> ${siteConfig.title} is Amiya_desi's personal blog for notes, project writeups, homelab records, Cloudflare/Docker/Linux operations, Godot game development, Obsidian publishing workflows, AI-assisted development, and everyday retrospectives.`,
		"",
		"## Context",
		"",
		`- Site: ${siteConfig.siteURL}`,
		`- Owner: ${profileConfig.name}`,
		`- Language: ${siteConfig.lang.replace("_", "-")}`,
		`- Description: ${siteConfig.subtitle}`,
		"- Purpose: personal writing, durable project notes, public tutorials, and long-term records.",
		"",
		"This is a personal blog, not a local business or commercial service site. It does not publish local addresses, company phone numbers, price tables, or commercial delivery promises.",
		"",
		"## Core Links",
		"",
		`- Blog home: ${siteConfig.siteURL}`,
		"- Main desk: https://sayori.org/",
		"- Guestbook: https://blog.sayori.org/guestbook/",
		`- RSS: ${new URL("rss.xml", siteConfig.siteURL).href}`,
		`- Sitemap: ${new URL("sitemap.xml", siteConfig.siteURL).href}`,
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
		"Search indexing, real-time AI grounding, AI citation, and model training uses are allowed for public content. The canonical sitemap is linked above, and llms.txt is advertised from the site's HTML head.",
	];

	return new Response(lines.join("\n"), {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
		},
	});
};
