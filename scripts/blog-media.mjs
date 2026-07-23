import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import sharp from "sharp";

const DEFAULT_WIDTHS = [640, 1280, 1920];
const IMAGE_EXTENSIONS = new Set([
	".avif",
	".bmp",
	".gif",
	".ico",
	".jpeg",
	".jpg",
	".png",
	".svg",
	".webp",
]);
const PASSTHROUGH_EXTENSIONS = new Set([".gif", ".svg"]);
const DEFAULT_REMOTE_POST_SLUGS = [
	"cross-app-tracking-device-fingerprinting",
	"mobile-app-ad-targeting-device-profiling",
	"rogue-app-advertising-user-traps",
];
const DEFAULT_REMOTE_HOSTS = new Set(["cdn3.ldstatic.com"]);

export function buildVariantWidths(sourceWidth, targets = DEFAULT_WIDTHS) {
	const width = Number(sourceWidth);
	if (!Number.isInteger(width) || width <= 0) {
		throw new Error(`Invalid source image width: ${sourceWidth}`);
	}
	return [...new Set(targets.map((target) => Math.min(target, width)))].sort(
		(a, b) => a - b,
	);
}

export function buildManifestIndex(manifest) {
	const index = new Map();
	for (const asset of manifest?.assets || []) {
		for (const value of [
			asset.source?.path,
			asset.source?.publicPath,
			asset.source?.url,
			asset.primaryUrl,
			...(asset.variants || []).map((variant) => variant.url),
		]) {
			for (const key of manifestLookupKeys(value)) {
				if (!index.has(key)) index.set(key, asset);
			}
		}
	}
	return index;
}

export function resolveManifestAsset(index, source) {
	for (const key of manifestLookupKeys(source)) {
		const asset = index.get(key);
		if (asset) return asset;
	}
	return null;
}

export async function prepareBlogMedia({
	contentDir,
	outputDir,
	baseUrl,
	remotePostSlugs = DEFAULT_REMOTE_POST_SLUGS,
	remoteHosts = DEFAULT_REMOTE_HOSTS,
	fetchImpl = globalThis.fetch,
	logger = console,
}) {
	const resolvedContentDir = path.resolve(contentDir);
	const resolvedOutputDir = path.resolve(outputDir);
	const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
	const postsRoot = path.join(resolvedContentDir, "posts");
	if (!fs.existsSync(postsRoot)) {
		throw new Error(
			`Blog media content directory is missing posts/: ${postsRoot}`,
		);
	}

	fs.mkdirSync(path.join(resolvedOutputDir, "objects"), { recursive: true });
	const localSources = collectLocalImageSources(postsRoot);
	const remoteSources = collectRemoteImageSources(
		postsRoot,
		remotePostSlugs,
		remoteHosts,
	);
	await prefetchRemoteSources(
		remoteSources,
		path.join(resolvedOutputDir, "downloads"),
		fetchImpl,
	);
	const sources = [...localSources, ...remoteSources].sort(compareSources);
	const processedByHash = new Map();
	const assets = [];
	const objects = new Map();

	for (const source of sources) {
		const { bytes, extension } = await readSourceBytes(source, fetchImpl);
		const hash = crypto.createHash("sha256").update(bytes).digest("hex");
		let processed = processedByHash.get(hash);
		if (!processed) {
			processed = await processImage({
				bytes,
				extension,
				hash,
				outputDir: resolvedOutputDir,
				baseUrl: normalizedBaseUrl,
			});
			processedByHash.set(hash, processed);
			for (const object of processed.objects) {
				objects.set(object.objectKey, object);
			}
		}

		assets.push({
			source:
				source.kind === "local"
					? {
							kind: "local",
							path: source.path,
							publicPath: source.publicPath,
						}
					: { kind: "remote", url: source.url, post: source.post },
			hash,
			sourceByteLength: bytes.byteLength,
			width: processed.width,
			height: processed.height,
			format: processed.format,
			primaryUrl: processed.primaryUrl,
			variants: processed.variants,
		});
	}

	const manifest = {
		version: 1,
		generatedAt: new Date().toISOString(),
		baseUrl: normalizedBaseUrl,
		assets,
		summary: {
			localSources: localSources.length,
			remoteSources: remoteSources.length,
			objects: objects.size,
			objectBytes: [...objects.values()].reduce(
				(total, object) => total + object.byteLength,
				0,
			),
		},
	};
	const manifestPath = path.join(resolvedOutputDir, "manifest.json");
	fs.writeFileSync(
		manifestPath,
		`${JSON.stringify(manifest, null, 2)}\n`,
		"utf8",
	);
	logger.info?.(
		`[blog-media] prepared ${assets.length} sources and ${objects.size} objects`,
	);

	return {
		manifest,
		manifestPath,
		objects: [...objects.values()],
	};
}

export async function verifyRemoteManifest(
	manifest,
	{ fetchImpl = globalThis.fetch, concurrency = 8 } = {},
) {
	if (typeof fetchImpl !== "function") {
		throw new Error(
			"No fetch implementation is available for remote media verification",
		);
	}
	const targetsByUrl = new Map();
	for (const asset of manifest?.assets || []) {
		for (const variant of asset.variants || []) {
			if (variant?.url && !targetsByUrl.has(variant.url)) {
				targetsByUrl.set(variant.url, variant);
			}
		}
	}
	const targets = [...targetsByUrl.values()];
	let cursor = 0;
	const failures = [];
	async function consume() {
		while (cursor < targets.length) {
			const target = targets[cursor++];
			const { url } = target;
			try {
				const response = await fetchImpl(url, {
					method: "HEAD",
					signal: AbortSignal.timeout(15_000),
				});
				const contentType = response.headers.get("content-type") || "";
				if (!response.ok || !contentType.startsWith("image/")) {
					failures.push(
						`${response.status} ${contentType || "missing content-type"} ${url}`,
					);
					continue;
				}
				const contentLength = Number(
					response.headers.get("content-length"),
				);
				if (
					Number.isFinite(target.byteLength) &&
					target.byteLength > 0 &&
					contentLength !== target.byteLength
				) {
					failures.push(
						`content-length ${contentLength || "missing"} != ${target.byteLength} ${url}`,
					);
				}
			} catch (error) {
				failures.push(`${error.message} ${url}`);
			}
		}
	}
	await Promise.all(
		Array.from({ length: Math.min(concurrency, targets.length) }, consume),
	);
	if (failures.length) {
		throw new Error(
			`Remote blog media verification failed:\n${failures.join("\n")}`,
		);
	}
	return targets.length;
}

export async function findMissingRemoteObjects(
	objects,
	{ fetchImpl = globalThis.fetch, concurrency = 8 } = {},
) {
	if (typeof fetchImpl !== "function") {
		throw new Error(
			"No fetch implementation is available for remote media lookup",
		);
	}
	let cursor = 0;
	const missing = [];
	const failures = [];
	async function consume() {
		while (cursor < objects.length) {
			const object = objects[cursor++];
			try {
				const response = await fetchImpl(object.url, {
					method: "HEAD",
					signal: AbortSignal.timeout(15_000),
				});
				if (response.status === 404) {
					missing.push(object);
					continue;
				}
				if (!response.ok) {
					failures.push(`${response.status} ${object.url}`);
					continue;
				}
				const contentType = response.headers.get("content-type") || "";
				const contentLength = Number(
					response.headers.get("content-length"),
				);
				if (!contentType.startsWith("image/")) {
					failures.push(
						`${response.status} ${contentType || "missing content-type"} ${object.url}`,
					);
				} else if (contentLength !== object.byteLength) {
					failures.push(
						`content-length ${contentLength || "missing"} != ${object.byteLength} ${object.url}`,
					);
				}
			} catch (error) {
				failures.push(`${error.message} ${object.url}`);
			}
		}
	}
	await Promise.all(
		Array.from({ length: Math.min(concurrency, objects.length) }, consume),
	);
	if (failures.length) {
		throw new Error(
			`Remote blog media lookup failed:\n${failures.join("\n")}`,
		);
	}
	return missing;
}

function collectLocalImageSources(postsRoot) {
	const postRoots = collectPostRoots(postsRoot);
	const sources = [];
	for (const filePath of walkFiles(postsRoot)) {
		const extension = path.extname(filePath).toLowerCase();
		if (!IMAGE_EXTENSIONS.has(extension)) continue;
		const postRoot = findOwningPostRoot(filePath, postRoots);
		const standaloneOwner = postRoot
			? null
			: findStandaloneMarkdownOwner(filePath, postsRoot);
		if (!postRoot && !standaloneOwner) {
			throw new Error(
				`Local post image has no unambiguous Markdown owner: ${filePath}`,
			);
		}
		const slug = postRoot
			? path
					.relative(postsRoot, postRoot)
					.split(path.sep)
					.filter(Boolean)
					.map(slugify)
					.join("/")
			: path
					.relative(postsRoot, standaloneOwner)
					.replace(/\.(md|mdx)$/i, "")
					.split(path.sep)
					.filter(Boolean)
					.map(slugify)
					.join("/");
		const assetRoot = postRoot || path.dirname(standaloneOwner);
		const relativeAssetPath = path
			.relative(assetRoot, filePath)
			.replaceAll("\\", "/");
		const publicPath = encodeUrlPath(
			`/images/posts/${slug}/${relativeAssetPath}`,
		);
		sources.push({
			kind: "local",
			absolutePath: filePath,
			path: path
				.relative(path.dirname(postsRoot), filePath)
				.replaceAll("\\", "/"),
			publicPath,
		});
	}
	return sources;
}

function collectPostRoots(postsRoot) {
	const roots = [];
	for (const directory of walkDirectories(postsRoot)) {
		if (isPostFolder(directory)) roots.push(directory);
	}
	return roots.sort((a, b) => b.length - a.length);
}

function isPostFolder(directory) {
	const directoryName = path.basename(directory).toLowerCase();
	return fs.readdirSync(directory, { withFileTypes: true }).some((entry) => {
		if (!entry.isFile() || !/\.(md|mdx)$/i.test(entry.name)) return false;
		const baseName = entry.name.replace(/\.(md|mdx)$/i, "").toLowerCase();
		return baseName === directoryName || baseName === "index";
	});
}

function findOwningPostRoot(filePath, postRoots) {
	return (
		postRoots.find((postRoot) => isPathInside(postRoot, filePath)) || null
	);
}

function findStandaloneMarkdownOwner(filePath, postsRoot) {
	let directory = path.dirname(filePath);
	while (isPathInside(postsRoot, directory) || directory === postsRoot) {
		const markdownFiles = fs
			.readdirSync(directory, { withFileTypes: true })
			.filter(
				(entry) => entry.isFile() && /\.(md|mdx)$/i.test(entry.name),
			);
		if (markdownFiles.length === 1) {
			return path.join(directory, markdownFiles[0].name);
		}
		if (directory === postsRoot) break;
		directory = path.dirname(directory);
	}
	return null;
}

function collectRemoteImageSources(postsRoot, postSlugs, remoteHosts) {
	const sources = new Map();
	for (const postSlug of postSlugs) {
		const postRoot = path.join(postsRoot, postSlug);
		if (!fs.existsSync(postRoot)) continue;
		for (const filePath of walkFiles(postRoot)) {
			if (!/\.(md|mdx)$/i.test(filePath)) continue;
			const content = fs.readFileSync(filePath, "utf8");
			for (const url of extractRemoteImageUrls(content)) {
				const parsed = new URL(url);
				if (!remoteHosts.has(parsed.hostname.toLowerCase())) continue;
				const extension = path.extname(parsed.pathname).toLowerCase();
				if (!IMAGE_EXTENSIONS.has(extension)) continue;
				sources.set(url, { kind: "remote", url, post: postSlug });
			}
		}
	}
	return [...sources.values()];
}

function extractRemoteImageUrls(content) {
	const urls = [];
	const markdownImagePattern =
		/!\[[^\]]*\]\(\s*(https?:\/\/[^\s)]+)(?:\s+["'][^)]*)?\)/g;
	const htmlImagePattern =
		/<img\b[^>]*\bsrc=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
	for (const pattern of [markdownImagePattern, htmlImagePattern]) {
		for (const match of content.matchAll(pattern)) urls.push(match[1]);
	}
	return urls;
}

async function readSourceBytes(source, fetchImpl) {
	if (source.kind === "local") {
		return {
			bytes: fs.readFileSync(source.absolutePath),
			extension: path.extname(source.absolutePath).toLowerCase(),
		};
	}
	if (typeof fetchImpl !== "function") {
		throw new Error(
			`No fetch implementation is available for ${source.url}`,
		);
	}
	return {
		bytes: fs.readFileSync(source.cachedPath),
		extension: path.extname(new URL(source.url).pathname).toLowerCase(),
	};
}

async function prefetchRemoteSources(sources, cacheDir, fetchImpl) {
	if (!sources.length) return;
	if (typeof fetchImpl !== "function") {
		throw new Error(
			"No fetch implementation is available for remote blog media",
		);
	}
	fs.mkdirSync(cacheDir, { recursive: true });
	let cursor = 0;
	async function consume() {
		while (cursor < sources.length) {
			const source = sources[cursor++];
			source.cachedPath = await downloadRemoteSource(
				source,
				cacheDir,
				fetchImpl,
			);
		}
	}
	await Promise.all(
		Array.from({ length: Math.min(4, sources.length) }, consume),
	);
}

async function downloadRemoteSource(source, cacheDir, fetchImpl) {
	const extension = path.extname(new URL(source.url).pathname).toLowerCase();
	const cacheKey = crypto
		.createHash("sha256")
		.update(source.url)
		.digest("hex");
	const cachePath = path.join(cacheDir, `${cacheKey}${extension}`);
	if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 0)
		return cachePath;

	let lastError;
	for (let attempt = 1; attempt <= 3; attempt++) {
		try {
			const response = await fetchImpl(source.url, {
				headers: {
					Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
					"User-Agent": "Sayori-Blog-Media/1.0",
				},
				signal: AbortSignal.timeout(60_000),
			});
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`);
			}
			const bytes = Buffer.from(await response.arrayBuffer());
			if (!bytes.length) throw new Error("empty response body");
			fs.writeFileSync(cachePath, bytes);
			return cachePath;
		} catch (error) {
			lastError = error;
			if (attempt < 3) await delay(500 * attempt);
		}
	}
	throw new Error(
		`Remote image fetch failed after 3 attempts: ${source.url}: ${lastError?.message || "unknown error"}`,
	);
}

function delay(milliseconds) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function processImage({ bytes, extension, hash, outputDir, baseUrl }) {
	const metadata = await sharp(bytes, { animated: true }).metadata();
	const { width, height } = getDisplayDimensions(metadata);
	if (PASSTHROUGH_EXTENSIONS.has(extension)) {
		const relativePath = `${hash}/original${extension}`;
		const outputPath = path.join(
			outputDir,
			"objects",
			...relativePath.split("/"),
		);
		writeBuffer(outputPath, bytes);
		const url = `${baseUrl}/${relativePath}`;
		return {
			width,
			height,
			format: extension.slice(1),
			primaryUrl: url,
			variants: [{ width, height, byteLength: bytes.byteLength, url }],
			objects: [
				{
					objectKey: `blog/v1/${relativePath}`,
					filePath: outputPath,
					contentType:
						extension === ".gif" ? "image/gif" : "image/svg+xml",
					byteLength: bytes.byteLength,
					url,
				},
			],
		};
	}

	if (!width || !height) {
		throw new Error(`Raster image ${hash} has no usable width or height`);
	}
	const variants = [];
	const objects = [];
	for (const variantWidth of buildVariantWidths(width)) {
		const pipeline = sharp(bytes, {
			animated: Number(metadata.pages || 1) > 1,
		})
			.rotate()
			.resize({
				width: variantWidth,
				withoutEnlargement: true,
			});
		const { data: optimized, info } =
			extension === ".png"
				? await pipeline
						.webp({ quality: 85, nearLossless: true, effort: 4 })
						.toBuffer({ resolveWithObject: true })
				: await pipeline
						.webp({ quality: 82, effort: 4 })
						.toBuffer({ resolveWithObject: true });
		const actualWidth = Number(info.width);
		const actualHeight = Number(info.pageHeight || info.height);
		if (!actualWidth || !actualHeight) {
			throw new Error(`Optimized image ${hash} has no usable dimensions`);
		}
		const relativePath = `${hash}/${actualWidth}.webp`;
		const outputPath = path.join(
			outputDir,
			"objects",
			...relativePath.split("/"),
		);
		writeBuffer(outputPath, optimized);
		const url = `${baseUrl}/${relativePath}`;
		variants.push({
			width: actualWidth,
			height: actualHeight,
			byteLength: optimized.byteLength,
			url,
		});
		objects.push({
			objectKey: `blog/v1/${relativePath}`,
			filePath: outputPath,
			contentType: "image/webp",
			byteLength: optimized.byteLength,
			url,
		});
	}
	const primary =
		variants.find((variant) => variant.width >= 1280) || variants.at(-1);
	return {
		width,
		height,
		format: "webp",
		primaryUrl: primary.url,
		variants,
		objects,
	};
}

function getDisplayDimensions(metadata) {
	const rawWidth = Number(metadata.width);
	const rawHeight = Number(metadata.pageHeight || metadata.height);
	if (!rawWidth || !rawHeight) return { width: null, height: null };
	const swapsAxes = [5, 6, 7, 8].includes(Number(metadata.orientation));
	return swapsAxes
		? { width: rawHeight, height: rawWidth }
		: { width: rawWidth, height: rawHeight };
}

function writeBuffer(filePath, bytes) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	if (fs.existsSync(filePath) && fs.readFileSync(filePath).equals(bytes))
		return;
	fs.writeFileSync(filePath, bytes);
}

function normalizeBaseUrl(value) {
	const url = new URL(String(value || "").trim());
	if (!["http:", "https:"].includes(url.protocol)) {
		throw new Error(`Unsupported blog media base URL: ${url.protocol}`);
	}
	url.search = "";
	url.hash = "";
	return url.toString().replace(/\/$/, "");
}

function manifestLookupKeys(value) {
	if (typeof value !== "string" || !value.trim()) return [];
	const normalized = value.trim().replaceAll("\\", "/");
	const keys = new Set([normalized]);
	try {
		keys.add(decodeURI(normalized));
	} catch {
		// Keep the original key when a source contains malformed escapes.
	}
	return [...keys];
}

function compareSources(a, b) {
	const left = a.kind === "local" ? a.path : a.url;
	const right = b.kind === "local" ? b.path : b.url;
	return left.localeCompare(right, "en");
}

function slugify(value) {
	return value
		.normalize("NFKD")
		.toLowerCase()
		.trim()
		.replace(/[^\p{Letter}\p{Number}]+/gu, "-")
		.replace(/^-+|-+$/g, "");
}

function encodeUrlPath(value) {
	return value
		.replaceAll("\\", "/")
		.split("/")
		.map((segment) => (segment ? encodeURIComponent(segment) : ""))
		.join("/");
}

function isPathInside(parent, candidate) {
	const relative = path.relative(parent, candidate);
	return (
		relative !== "" &&
		!relative.startsWith("..") &&
		!path.isAbsolute(relative)
	);
}

function* walkFiles(directory) {
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const current = path.join(directory, entry.name);
		if (entry.isDirectory()) yield* walkFiles(current);
		else if (entry.isFile()) yield current;
	}
}

function* walkDirectories(directory) {
	yield directory;
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		if (entry.isDirectory())
			yield* walkDirectories(path.join(directory, entry.name));
	}
}
