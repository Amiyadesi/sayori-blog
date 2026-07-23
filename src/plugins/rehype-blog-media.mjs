import fs from "node:fs";
import path from "node:path";

import { visit } from "unist-util-visit";

const DEFAULT_SIZES = "(max-width: 768px) 100vw, 46rem";

export function rehypeBlogMedia(options = {}) {
	const manifest = Object.hasOwn(options, "manifest")
		? options.manifest
		: loadManifestFromEnvironment();
	const index = buildIndex(manifest);

	return (tree) => {
		visit(tree, "element", (node) => {
			if (node.tagName !== "img" || !node.properties) return;
			node.properties.loading ||= "lazy";
			node.properties.decoding ||= "async";

			const asset = resolveAsset(
				index,
				String(node.properties.src || ""),
			);
			if (!asset) return;
			node.properties.src = asset.primaryUrl;
			const variants = (asset.variants || []).filter(
				(variant) => Number.isFinite(variant.width) && variant.url,
			);
			if (variants.length > 1) {
				node.properties.srcSet = variants
					.map((variant) => `${variant.url} ${variant.width}w`)
					.join(", ");
				node.properties.sizes ||= DEFAULT_SIZES;
			}
			applyIntrinsicDimensions(node.properties, asset);
		});
	};
}

function loadManifestFromEnvironment() {
	const baseUrl = String(process.env.BLOG_MEDIA_BASE_URL || "").trim();
	if (!baseUrl) return null;
	const manifestPath = path.resolve(
		process.cwd(),
		String(
			process.env.BLOG_MEDIA_MANIFEST ||
				path.join(".cache", "blog-media", "manifest.json"),
		),
	);
	if (!fs.existsSync(manifestPath)) {
		throw new Error(`Blog media manifest missing: ${manifestPath}`);
	}
	const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
	if (normalizeBaseUrl(manifest.baseUrl) !== normalizeBaseUrl(baseUrl)) {
		throw new Error(
			"Blog media manifest base URL does not match BLOG_MEDIA_BASE_URL",
		);
	}
	return manifest;
}

function buildIndex(manifest) {
	const index = new Map();
	for (const asset of manifest?.assets || []) {
		for (const value of [
			asset.source?.path,
			asset.source?.publicPath,
			asset.source?.url,
			asset.primaryUrl,
			...(asset.variants || []).map((variant) => variant.url),
		]) {
			for (const key of lookupKeys(value)) {
				if (!index.has(key)) index.set(key, asset);
			}
		}
	}
	return index;
}

function resolveAsset(index, source) {
	for (const key of lookupKeys(source)) {
		const asset = index.get(key);
		if (asset) return asset;
	}
	return null;
}

function applyIntrinsicDimensions(properties, asset) {
	const sourceWidth = Number(asset.width);
	const sourceHeight = Number(asset.height);
	if (sourceWidth > 0) properties.width = sourceWidth;
	if (sourceHeight > 0) properties.height = sourceHeight;
}

function lookupKeys(value) {
	if (typeof value !== "string" || !value.trim()) return [];
	const normalized = value.trim().replaceAll("\\", "/");
	const keys = new Set([normalized]);
	try {
		keys.add(decodeURI(normalized));
	} catch {
		// Keep the original value when the source contains malformed escapes.
	}
	return [...keys];
}

function normalizeBaseUrl(value) {
	return String(value || "")
		.trim()
		.replace(/\/+$/, "");
}
