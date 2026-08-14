import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const dist = path.resolve("dist");
const required = [
	"index.html",
	"en/index.html",
	"robots.txt",
	"rss.xml",
	"atom.xml",
	"sitemap.xml",
	"sitemap-0.xml",
	"en/sitemap-0.xml",
	"llms.txt",
	"assets/js/twikoo.all.min.js",
	"en/assets/js/twikoo.all.min.js",
];

for (const file of required) {
	assert.ok(
		fs.statSync(path.join(dist, file)).size > 0,
		`missing dist/${file}`,
	);
}

for (const route of [
	"admin",
	"archive",
	"essays",
	"sponsor",
	"topics",
	"api",
	"sayori-diary",
]) {
	assert.ok(
		!fs.existsSync(path.join(dist, route)),
		`unexpected diary route: /${route}/`,
	);
	assert.ok(
		!fs.existsSync(path.join(dist, "en", route)),
		`unexpected diary route: /en/${route}/`,
	);
}

for (const unexpected of [
	"assets/music",
	"assets/profile",
	"assets/desktop-banner",
	"images/posts/diary",
	"pagefind",
	"pio",
]) {
	assert.ok(!fs.existsSync(path.join(dist, unexpected)), `unexpected diary asset: ${unexpected}`);
	assert.ok(!fs.existsSync(path.join(dist, "en", unexpected)), `unexpected English diary asset: ${unexpected}`);
}

const totalBytes = walk(dist).reduce(
	(total, file) => total + fs.statSync(file).size,
	0,
);
assert.ok(totalBytes < 22 * 1024 * 1024, `diary build too large: ${totalBytes} bytes`);

const textFiles = walk(dist).filter((file) =>
	/\.(?:html|xml|txt)$/i.test(file),
);
for (const file of textFiles) {
	const content = fs.readFileSync(file, "utf8");
	assert.ok(
		!/blog\.sayori\.org\/api\/(?!twikoo\b)/.test(content),
		`${path.relative(dist, file)} references a main blog API`,
	);
}

for (const feed of [
	"rss.xml",
	"atom.xml",
	"llms.txt",
	"sitemap-0.xml",
	"en/sitemap-0.xml",
]) {
	const content = fs.readFileSync(path.join(dist, feed), "utf8");
	assert.ok(
		!content.includes("/posts/diary/"),
		`${feed} includes main blog content`,
	);
}

console.log("[verify-sayori-diary-build] passed");

function walk(dir) {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const item = path.join(dir, entry.name);
		return entry.isDirectory() ? walk(item) : [item];
	});
}
