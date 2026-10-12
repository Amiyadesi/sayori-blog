import type { APIRoute } from "astro";

const robotsTxt = `
User-agent: *
Allow: /
${process.env.SITE_VARIANT === "sayori-diary" ? "Disallow: /admin/\n" : ""}Disallow: /api/

Sitemap: ${new URL("sitemap.xml", import.meta.env.SITE).href}
`.trim();

export const GET: APIRoute = () => {
	return new Response(robotsTxt, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
		},
	});
};
