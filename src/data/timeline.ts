import type { TimelineItem } from "../components/features/timeline/types";

export const timelineData: TimelineItem[] = [
	{
		id: "twikoo-comments",
		title: "Twikoo 评论系统接入",
		description:
			"博客评论前端切到 Twikoo，后端规划为 Vercel + MongoDB Atlas，通过 comments.sayori.org 作为长期入口。",
		type: "project",
		startDate: "2026-05-25",
		organization: "Sayori Blog",
		skills: ["Twikoo", "Vercel", "MongoDB Atlas", "Cloudflare DNS"],
		achievements: [
			"评论功能不占用低内存 VPS",
			"博客配置固定使用 comments.sayori.org",
			"保留后续迁移评论后端的空间",
		],
		links: [
			{
				name: "评论入口",
				url: "https://comments.sayori.org",
				type: "website",
			},
		],
		icon: "material-symbols:chat",
		color: "#ec4899",
		featured: true,
	},
	{
		id: "mizuki-blog",
		title: "Mizuki 博客启用",
		description:
			"将博客迁到 Mizuki/Astro，文章从本地 articles/ 同步，适合用 Obsidian 写 Markdown 后发布。",
		type: "project",
		startDate: "2026-05-21",
		organization: "Sayori Blog",
		skills: ["Astro", "Mizuki", "Markdown", "Obsidian"],
		achievements: [
			"保留标准 Markdown/frontmatter 写作方式",
			"支持 RSS、搜索、标签和文章详情页",
			"第一篇文章 Hello Sayori 发布",
		],
		links: [
			{
				name: "博客首页",
				url: "https://blog.sayori.org",
				type: "website",
			},
		],
		icon: "material-symbols:article",
		color: "#f97316",
		featured: true,
	},
	{
		id: "cloudflare-pages",
		title: "主站与博客迁移到 Cloudflare Pages",
		description:
			"把静态站点从 VPS 移到 Cloudflare Pages，服务器继续专注跑 Vaultwarden、状态页和 Tunnel。",
		type: "project",
		startDate: "2026-05-20",
		organization: "Cloudflare Pages",
		skills: ["Cloudflare Pages", "Wrangler", "Static Site"],
		achievements: [
			"降低 VPS 内存压力",
			"主站 sayori.org 和博客 blog.sayori.org 独立发布",
			"保留本地一键构建与 Direct Upload 流程",
		],
		links: [
			{
				name: "主入口",
				url: "https://sayori.org",
				type: "website",
			},
		],
		icon: "material-symbols:cloud",
		color: "#0ea5e9",
		featured: true,
	},
	{
		id: "vaultwarden-stack",
		title: "Vaultwarden 密码库稳定运行",
		description:
			"低内存 VPS 上用 Docker Compose 跑了一套自托管的 Vaultwarden，通过 Cloudflare Tunnel 接入，仅自用。",
		type: "project",
		startDate: "2026-05-18",
		organization: "VPS",
		skills: ["Vaultwarden", "Docker Compose", "Cloudflare Tunnel"],
		achievements: [
			"关闭公开注册，保留邀请能力",
			"SQLite 持久化，适合个人使用",
			"自建状态监控持续观察可用性",
		],
		icon: "material-symbols:encrypted",
		color: "#22c55e",
		featured: true,
	},
	{
		id: "blog-start",
		title: "博客正式开门",
		description:
			"从 Hello Sayori 开始，把服务器、工具链、创作复盘和生活笔记慢慢整理成可读的文章。",
		type: "achievement",
		startDate: "2026-05-21",
		organization: "Amiya_desi",
		skills: ["Writing", "Markdown", "Personal Knowledge Base"],
		achievements: [
			"确定文章库 articles/ 作为发布源",
			"保留 Obsidian 友好的写作习惯",
			"从零散笔记走向长期维护的个人站",
		],
		links: [
			{
				name: "Hello Sayori",
				url: "https://blog.sayori.org/posts/hello-sayori/",
				type: "website",
			},
		],
		icon: "material-symbols:flag",
		color: "#8b5cf6",
	},
	{
		id: "diary-public-start",
		title: "公开日记整理起点",
		description:
			"从 2026-04-05 的第一篇公开整理版日记开始，把 Obsidian 里的真实记录按公开边界整理到博客。",
		type: "achievement",
		startDate: "2026-04-05",
		endDate: "2026-05-26",
		organization: "Obsidian",
		skills: ["Obsidian", "Markdown", "日常记录"],
		achievements: [
			"保留原始语气",
			"隐去私密人名和账号细节",
			"让归档按真实写作时间显示",
		],
		links: [
			{
				name: "第一篇公开日记",
				url: "https://blog.sayori.org/posts/diary/2026-04-05/",
				type: "website",
			},
		],
		icon: "material-symbols:edit-calendar",
		color: "#f59e0b",
	},
];
