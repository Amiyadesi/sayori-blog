import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const blogRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const configPath = path.join(blogRoot, "src", "config.ts");
const distDir = path.join(blogRoot, "dist");
const localeBase = String(process.env.PRUNE_BASE || "")
	.trim()
	.replace(/^\/+|\/+$/g, "");
const outputDir = path.join(distDir, localeBase);

const featureRoutes = {
	albums: ["albums"],
	devices: ["devices"],
	diary: ["diary"],
	projects: ["projects"],
	skills: ["skills"],
};

if (!fs.existsSync(outputDir)) {
	throw new Error(`build directory not found: ${outputDir}`);
}

const disabled = readDisabledFeaturePages();
let removed = 0;

for (const feature of disabled) {
	for (const route of featureRoutes[feature] ?? []) {
		const target = path.join(outputDir, route);
		if (!fs.existsSync(target)) {
			continue;
		}
		fs.rmSync(target, { recursive: true, force: true });
		removed++;
		console.log(
			`[prune-disabled-pages] removed /${localeBase ? `${localeBase}/` : ""}${route}/`,
		);
	}
}

console.log(
	`[prune-disabled-pages] done (${removed} route${removed === 1 ? "" : "s"} removed)`,
);

function readDisabledFeaturePages() {
	const config = fs.readFileSync(configPath, "utf8");
	const match = config.match(/featurePages:\s*\{([\s\S]*?)\}/);
	if (!match) {
		throw new Error("siteConfig.featurePages block not found");
	}

	const disabledFeatures = [];
	for (const feature of Object.keys(featureRoutes)) {
		const featureMatch = match[1].match(
			new RegExp(`\\b${feature}\\s*:\\s*(true|false)`),
		);
		if (!featureMatch) {
			throw new Error(`siteConfig.featurePages.${feature} not found`);
		}
		if (featureMatch[1] === "false") {
			disabledFeatures.push(feature);
		}
	}
	return disabledFeatures;
}
