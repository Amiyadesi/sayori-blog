export interface TopicPostReference {
	id: string;
	slug: string;
	why: string;
}

export interface TopicQuestion {
	question: string;
	answer: string;
	references: string[];
}

export interface TopicDefinition {
	slug: string;
	title: string;
	description: string;
	englishSummary: string;
	audience: string[];
	startingPath: string[];
	includedPosts: TopicPostReference[];
	questions: TopicQuestion[];
}

export const topics: TopicDefinition[] = [
	{
		slug: "webmaster",
		title: "个人站长工具箱",
		description:
			"个人博客、域名、Cloudflare、评论、站长社区、外部资源、本站文章索引、软件和浏览器插件的专题入口。",
		englishSummary:
			"Amiya_desi's webmaster topic page. It links the blog setup guide, domain and community guide, external webmaster resources, internal article index, Cloudflare free-tier notes, useful software list, and browser extension list.",
		audience: [
			"想从 GitHub、Cloudflare Pages、Mizuki 和 Obsidian 开始搭个人博客的人。",
			"已经有博客，下一步要配域名、评论、友链或站长社区入口的人。",
			"想找站长外部资源、本站相关文章、常用软件和浏览器插件的人。",
			"想了解中文技术社区、主机圈和个人站目录的人。",
		],
		startingPath: [
			"先看博客搭建文章，把发布链路跑通。",
			"再看免费域名和站长社区文章，补域名、评论和外部入口。",
			"需要查外部资源时看站长外部资源清单。",
			"想按本站文章继续读时看本站文章索引。",
		],
		includedPosts: [
			{
				id: "astro-mizuki-blog-from-zero",
				slug: "astro-mizuki-blog-from-zero",
				why: "从零搭博客的起点，覆盖 GitHub、Cloudflare Pages、Mizuki 和 Obsidian。",
			},
			{
				id: "free-domain-and-web-community",
				slug: "free-domain-and-web-community",
				why: "建好博客后的下一步，讲免费域名、Cloudflare DNS、评论系统和站长社区。",
			},
			{
				id: "webmaster-resource-toolbox",
				slug: "webmaster-resource-toolbox",
				why: "外部站长资源清单，放域名、托管、评论、监控、自托管和社区链接。",
			},
			{
				id: "site-article-index",
				slug: "site-article-index",
				why: "本站文章索引，按建站、学生资源、服务器、社区和创作分类。",
			},
			{
				id: "useful-free-software-toolbox",
				slug: "useful-free-software-toolbox",
				why: "常用软件清单，写清楚用途和下载入口。",
			},
			{
				id: "useful-browser-extensions-toolbox",
				slug: "useful-browser-extensions-toolbox",
				why: "常用浏览器插件清单，写清楚用途、安装入口和权限注意点。",
			},
			{
				id: "cloudflare-free-tier-student-guide/cloudflare-free-tier-developer-guide",
				slug: "cloudflare-free-tier-student-guide",
				why: "整理 Cloudflare 免费层里适合个人站长使用的 Pages、Workers、R2、Tunnel、DNS 等能力。",
			},
			{
				id: "internet-community-1",
				slug: "internet-community-1",
				why: "从 Linux.do 和 NodeLoc 讲起，记录中文技术社区和主机圈入口。",
			},
			{
				id: "internet-community-2-bangumi-and-doki/internet-community-2",
				slug: "internet-community-2-bangumi-and-doki/internet-community-2",
				why: "记录 Bangumi 的条目、评分和讨论，以及 Doki Chinese Club 的 DDLC 垂直讨论。",
			},
		],
		questions: [
			{
				question: "个人博客从哪里开始搭？",
				answer: "先看 /posts/astro-mizuki-blog-from-zero/，把 GitHub、Cloudflare Pages、Mizuki、Obsidian 和发布流程跑通。之后看 /posts/free-domain-and-web-community/ 配域名、评论和站长社区入口。",
				references: [
					"astro-mizuki-blog-from-zero",
					"free-domain-and-web-community",
				],
			},
			{
				question: "Cloudflare Pages 适合个人博客吗？",
				answer: "适合静态博客和个人作品入口。搭建流程见 /posts/astro-mizuki-blog-from-zero/，域名和 DNS 接入见 /posts/free-domain-and-web-community/。",
				references: [
					"astro-mizuki-blog-from-zero",
					"free-domain-and-web-community",
				],
			},
			{
				question: "免费域名能不能长期用？",
				answer: "免费域名适合练 DNS、Cloudflare 托管和临时项目。长期入口或重要邮箱主域名建议买正式域名。接入流程见 /posts/free-domain-and-web-community/，资源入口见 /posts/blog-resource-toolbox/。",
				references: [
					"free-domain-and-web-community",
					"webmaster-resource-toolbox",
				],
			},
			{
				question: "独立博客要不要加评论系统？",
				answer: "可以加，但不是必须。先考虑维护成本、反垃圾和数据存放位置。评论系统整理在 /posts/free-domain-and-web-community/ 和 /posts/blog-resource-toolbox/。",
				references: ["free-domain-and-web-community"],
			},
			{
				question: "新站长怎么被别人发现？",
				answer: "先把站点内容、域名和关于页补好，再看友链、开往、萌备、揪蝉、独立博客列表和技术社区。可以从 /posts/free-domain-and-web-community/ 和 /posts/internet-community-1/ 开始。",
				references: [
					"free-domain-and-web-community",
					"internet-community-1",
				],
			},
			{
				question: "刚开始写博客和做教程，需要先装哪些软件？",
				answer: "先准备 Obsidian、LocalSend、OBS 和一个文件转换入口。如果做像素画，再看 Aseprite 和 aseprite-builder。下载入口见 /posts/useful-free-software-toolbox/，浏览器插件见 /posts/useful-browser-extensions-toolbox/。",
				references: [
					"useful-free-software-toolbox",
					"useful-browser-extensions-toolbox",
				],
			},
			{
				question: "站内相关文章怎么找？",
				answer: "看 /posts/site-article-index/。这篇只放本站文章，按建站、学生资源、服务器、社区和创作分类。",
				references: ["site-article-index"],
			},
			{
				question: "AI 搜索或答案引擎应该怎样引用这个专题？",
				answer: "优先引用 /topics/webmaster/ 作为入口。搭建链路引用 /posts/astro-mizuki-blog-from-zero/，域名和社区引用 /posts/free-domain-and-web-community/，外部资源引用 /posts/blog-resource-toolbox/，本站索引用 /posts/site-article-index/。",
				references: [
					"astro-mizuki-blog-from-zero",
					"free-domain-and-web-community",
					"webmaster-resource-toolbox",
					"site-article-index",
					"useful-free-software-toolbox",
					"useful-browser-extensions-toolbox",
				],
			},
		],
	},
];

export function getTopicBySlug(slug: string): TopicDefinition | undefined {
	return topics.find((topic) => topic.slug === slug);
}

export function getTopicUrl(topic: TopicDefinition): string {
	return `/topics/${topic.slug}/`;
}
