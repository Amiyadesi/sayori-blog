import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_BASE_URL = "https://api.chksz.com";
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_REQUESTS = 20;
const MUSIC_RELATIVE_PATH = "site/music.json";
const LYRICS_RELATIVE_PATH = "assets/music/lyrics";

const ALLOWED_LEVELS = new Set([
	"standard",
	"exhigh",
	"lossless",
	"hires",
	"jyeffect",
	"sky",
	"jymaster",
]);

export function normalizeText(value) {
	return String(value ?? "")
		.normalize("NFKC")
		.toLocaleLowerCase()
		.replace(/\p{P}|\p{S}/gu, "")
		.replace(/\s+/g, "")
		.trim();
}

function asString(value) {
	return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

function asList(value) {
	if (Array.isArray(value)) return value;
	if (value && typeof value === "object") return [value];
	return [];
}

function firstString(...values) {
	return values.map(asString).find(Boolean) ?? "";
}

function artistText(value) {
	if (Array.isArray(value)) {
		return value
			.map((item) =>
				typeof item === "object"
					? firstString(item.name, item.artist)
					: asString(item),
			)
			.filter(Boolean)
			.join(" / ");
	}
	if (value && typeof value === "object") {
		return firstString(value.name, value.artist);
	}
	return asString(value);
}

export function selectSearchResult(payload, track) {
	const candidates = asList(payload?.data ?? payload?.list ?? payload?.results);
	const title = normalizeText(track?.title);
	const artist = normalizeText(track?.artist);
	if (!title || candidates.length === 0) return null;

	const exact = candidates.filter((candidate) => {
		const candidateTitle = normalizeText(
			candidate?.name ?? candidate?.title,
		);
		if (candidateTitle !== title) return false;
		if (!artist) return true;
		const candidateArtist = normalizeText(
			artistText(candidate?.artists ?? candidate?.artist ?? candidate?.author),
		);
		return candidateArtist.includes(artist) || artist.includes(candidateArtist);
	});

	return exact.length === 1 ? exact[0] : null;
}

export function parseTrackDetails(payload) {
	const data = payload?.data ?? payload;
	if (!data || typeof data !== "object") return null;
	const id = firstString(data.id, data.songId);
	const title = firstString(data.name, data.title);
	const artist = artistText(data.artist ?? data.artists ?? data.author);
	const cover = firstString(data.picUrl, data.pic, data.cover, data.coverUrl);
	if (!id && !title && !artist && !cover) return null;
	return { id, title, artist, cover };
}

export function parseSearchResult(candidate) {
	if (!candidate || typeof candidate !== "object") return null;
	return {
		id: firstString(candidate.id, candidate.songId),
		title: firstString(candidate.name, candidate.title),
		artist: artistText(candidate.artists ?? candidate.artist ?? candidate.author),
		cover: firstString(candidate.picUrl, candidate.pic, candidate.cover),
	};
}

export function parseLyrics(payload) {
	const data = payload?.data ?? payload;
	if (!data || typeof data !== "object") return null;
	const lyrics = {
		lrc: asString(data.lrc),
		translation: firstString(data.tlyric, data.translation),
		romanized: firstString(data.romalrc, data.romanized),
		karaoke: asString(data.klyric),
	};
	return Object.values(lyrics).some(Boolean) ? lyrics : null;
}

function hashKey(value) {
	return crypto.createHash("sha256").update(value).digest("hex");
}

function safeJsonRead(filePath) {
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf8"));
	} catch {
		return null;
	}
}

function writeJsonAtomic(filePath, value) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	const tempPath = `${filePath}.${process.pid}.tmp`;
	fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
	fs.renameSync(tempPath, filePath);
}

function getCacheFile(cacheDir, endpoint, params) {
	const key = hashKey(`${endpoint}?${new URLSearchParams(params).toString()}`);
	return path.join(cacheDir, `${key}.json`);
}

function createTimeoutSignal(timeoutMs) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

export function createChkszClient({
	apiKey,
	baseUrl = DEFAULT_BASE_URL,
	cacheDir = path.join(process.cwd(), ".cache", "chksz-music"),
	cacheTtlMs = DEFAULT_CACHE_TTL_MS,
	timeoutMs = DEFAULT_TIMEOUT_MS,
	fetchImpl = globalThis.fetch,
} = {}) {
	const key = asString(apiKey);
	const base = String(baseUrl).replace(/\/+$/, "");
	const memory = new Map();
	let requestCount = 0;

	async function request(endpoint, params) {
		if (!key) throw new Error("CHKSZ_API_KEY is not configured");
		const query = { ...params, apikey: key };
		const cacheParams = { ...params };
		const cacheFile = getCacheFile(cacheDir, endpoint, cacheParams);
		const cached = memory.get(cacheFile) ?? safeJsonRead(cacheFile);
		if (cached && Date.now() - Number(cached.cachedAt) < cacheTtlMs) {
			memory.set(cacheFile, cached);
			return cached.body;
		}

		const url = new URL(`${base}${endpoint}`);
		for (const [name, value] of Object.entries(query)) {
			url.searchParams.set(name, String(value));
		}
		const timeout = createTimeoutSignal(timeoutMs);
		try {
			requestCount += 1;
			const response = await fetchImpl(url, {
				headers: { Accept: "application/json" },
				signal: timeout.signal,
			});
			if (!response.ok) {
				throw new Error(`ChKSz request failed (${response.status})`);
			}
			const body = await response.json();
			if (body?.code && Number(body.code) >= 400) {
				throw new Error(`ChKSz request failed (${body.code})`);
			}
			const entry = { cachedAt: Date.now(), body };
			memory.set(cacheFile, entry);
			writeJsonAtomic(cacheFile, entry);
			return body;
		} finally {
			timeout.cancel();
		}
	}

	return {
		search(keyword) {
			return request("/api/163_search", { keyword, limit: 5, offset: 0 });
		},
		details(id, level = "standard") {
			return request("/api/163_music", {
				id,
				level: ALLOWED_LEVELS.has(level) ? level : "standard",
				type: "json",
			});
		},
		lyrics(id) {
			return request("/api/163_lyric", { id });
		},
		get requestCount() {
			return requestCount;
		},
	};
}

function isPlaceholderCover(value) {
	return !value || /placeholder/i.test(value);
}

function applyIfMissing(target, key, value, { replacePlaceholder = false } = {}) {
	if (!value) return false;
	if (target[key] && !(replacePlaceholder && isPlaceholderCover(target[key]))) {
		return false;
	}
	target[key] = value;
	return true;
}

function lyricsFileName(id) {
	return `${LYRICS_RELATIVE_PATH}/${id}.json`;
}

export async function enrichMusicConfig({
	contentDir,
	musicFile = path.join(contentDir, MUSIC_RELATIVE_PATH),
	lyricsDir = path.join(contentDir, LYRICS_RELATIVE_PATH),
	client,
	write = false,
	maxRequests = DEFAULT_MAX_REQUESTS,
	level = "standard",
	logger = console,
} = {}) {
	if (!client) throw new Error("client is required");
	const music = safeJsonRead(musicFile);
	if (!music || !Array.isArray(music.tracks)) {
		throw new Error(`Invalid music config: ${musicFile}`);
	}
	if (music.chksz?.enabled === false) {
		logger.log("[enrich-music] disabled in site/music.json; skipped");
		return { music, changed: false, requests: client.requestCount, skipped: music.tracks.length };
	}

	const tracks = music.tracks.map((track) => ({ ...track }));
	const lyrics = new Map();
	let changed = false;
	let skipped = 0;

	for (const track of tracks) {
		if (!track || typeof track !== "object" || !track.title) {
			skipped += 1;
			continue;
		}
		if (client.requestCount >= maxRequests) {
			skipped += 1;
			continue;
		}

		let id = asString(track.netease);
		let metadata = null;
		if (!id) {
			const result = selectSearchResult(
				await client.search(`${track.title} ${track.artist ?? ""}`.trim()),
				track,
			);
			metadata = parseSearchResult(result);
			if (metadata?.id) {
				id = metadata.id;
				changed = applyIfMissing(track, "netease", id) || changed;
			}
		}

		if (!id) {
			skipped += 1;
			continue;
		}

		if (
			!track.title ||
			!track.artist ||
			isPlaceholderCover(track.cover)
		) {
			if (client.requestCount >= maxRequests) break;
			const details = parseTrackDetails(await client.details(id, level));
			if (details) {
				changed = applyIfMissing(track, "title", details.title) || changed;
				changed = applyIfMissing(track, "artist", details.artist) || changed;
				changed =
					applyIfMissing(track, "cover", details.cover, {
						replacePlaceholder: true,
					}) || changed;
			}
		}

		if (track.lyrics || client.requestCount >= maxRequests) {
			continue;
		}
		const parsedLyrics = parseLyrics(await client.lyrics(id));
		if (parsedLyrics) {
			const fileName = lyricsFileName(id);
			track.lyrics = fileName;
			lyrics.set(fileName, parsedLyrics);
			changed = true;
		}
	}

	if (write && changed) {
		writeJsonAtomic(musicFile, { ...music, tracks });
		for (const [relativePath, value] of lyrics) {
			writeJsonAtomic(path.join(contentDir, relativePath), value);
		}
	}

	logger.log(
		`[enrich-music] tracks=${tracks.length} changed=${changed} requests=${client.requestCount} skipped=${skipped}`,
	);
	return { music: { ...music, tracks }, changed, requests: client.requestCount, skipped };
}

function parseArgs(argv) {
	const args = new Set(argv);
	const contentIndex = argv.indexOf("--content-dir");
	const contentDir =
		contentIndex >= 0 ? argv[contentIndex + 1] : process.env.CONTENT_DIR || process.cwd();
	return {
		contentDir,
		write: args.has("--write") || process.env.CHKSZ_MUSIC_WRITE === "true",
		maxRequests: Number(process.env.CHKSZ_MUSIC_MAX_REQUESTS || DEFAULT_MAX_REQUESTS),
		level: process.env.CHKSZ_MUSIC_LEVEL || "standard",
	};
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (!asString(process.env.CHKSZ_API_KEY)) {
		console.log("[enrich-music] CHKSZ_API_KEY is not configured; skipped");
		return;
	}
	const contentDir = path.resolve(options.contentDir);
	const client = createChkszClient({
		apiKey: process.env.CHKSZ_API_KEY,
		baseUrl: process.env.CHKSZ_API_BASE_URL || DEFAULT_BASE_URL,
		cacheDir: process.env.CHKSZ_CACHE_DIR || path.join(process.cwd(), ".cache", "chksz-music"),
	});
	try {
		await enrichMusicConfig({
			contentDir,
			client,
			write: options.write,
			maxRequests: Number.isFinite(options.maxRequests)
				? Math.max(0, options.maxRequests)
				: DEFAULT_MAX_REQUESTS,
			level: options.level,
		});
	} catch (error) {
		console.error(`[enrich-music] ${error instanceof Error ? error.message : "failed"}`);
		if (process.env.CHKSZ_MUSIC_REQUIRED === "true") process.exitCode = 1;
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
