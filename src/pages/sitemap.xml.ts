import type { APIRoute } from "astro";

const sitemapIndexUrl = new URL("sitemap-index.xml", import.meta.env.SITE).href;
const sitemapUrl = new URL("sitemap-0.xml", import.meta.env.SITE).href;

export const GET: APIRoute = () => {
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
	<sitemap>
		<loc>${sitemapUrl}</loc>
	</sitemap>
</sitemapindex>
`;

	return new Response(body, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"X-Sitemap-Index": sitemapIndexUrl,
		},
	});
};
