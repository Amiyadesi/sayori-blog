import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
	enrichMusicConfig,
	normalizeText,
	parseLyrics,
	parseSearchResult,
	parseTrackDetails,
	selectSearchResult,
} from "./enrich-music.mjs";

describe("music enrichment", () => {
	it("normalizes punctuation and whitespace for conservative matching", () => {
		assert.equal(normalizeText("  Ado！— 唱歌  "), "ado唱歌");
	});

	it("accepts one exact title and artist match only", () => {
		const payload = {
			data: [
				{ id: 7, name: "晴天", artists: "周杰伦", picUrl: "cover" },
				{ id: 8, name: "晴天", artists: "其他歌手" },
			],
		};
		assert.deepEqual(selectSearchResult(payload, { title: "晴天", artist: "周杰伦" }), payload.data[0]);
		assert.equal(selectSearchResult(payload, { title: "晴天", artist: "" }), null);
	});

	it("normalizes ChKSz detail and lyrics shapes", () => {
		assert.deepEqual(parseTrackDetails({ data: { id: 7, name: "晴天", artist: "周杰伦", picUrl: "cover" } }), {
			id: "7",
			title: "晴天",
			artist: "周杰伦",
			cover: "cover",
		});
		assert.deepEqual(parseLyrics({ data: { lrc: "[00:00]x", tlyric: "译", romalrc: "rom" } }), {
			lrc: "[00:00]x",
			translation: "译",
			romanized: "rom",
			karaoke: "",
		});
	});

	it("writes only missing metadata and lyric sidecars", async () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), "music-enrich-"));
		fs.mkdirSync(path.join(root, "site"), { recursive: true });
		fs.writeFileSync(path.join(root, "site/music.json"), JSON.stringify({ tracks: [
			{ id: 1, title: "晴天", artist: "周杰伦", netease: "7", cover: "cover/placeholder.svg" },
		] }));
		let requests = 0;
		const client = {
			get requestCount() { return requests; },
			async details() { requests += 1; return { data: { id: 7, name: "晴天", artist: "周杰伦", picUrl: "cover.jpg" } }; },
			async lyrics() { requests += 1; return { data: { lrc: "[00:00]x" } }; },
			async search() { throw new Error("search should not run"); },
		};
		const result = await enrichMusicConfig({ contentDir: root, client, write: true, maxRequests: 3, logger: { log() {} } });
		assert.equal(result.changed, true);
		const config = JSON.parse(fs.readFileSync(path.join(root, "site/music.json"), "utf8"));
		assert.equal(config.tracks[0].cover, "cover.jpg");
		assert.equal(config.tracks[0].lyrics, "assets/music/lyrics/7.json");
		assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, "assets/music/lyrics/7.json"), "utf8")), { lrc: "[00:00]x", translation: "", romanized: "", karaoke: "" });
	});

	it("skips requests when ChKSz enrichment is disabled", async () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), "music-enrich-disabled-"));
		fs.mkdirSync(path.join(root, "site"), { recursive: true });
		fs.writeFileSync(path.join(root, "site/music.json"), JSON.stringify({ chksz: { enabled: false }, tracks: [{ title: "晴天" }] }));
		let called = false;
		const client = {
			get requestCount() { return 0; },
			async search() { called = true; return { data: [] }; },
		};
		const result = await enrichMusicConfig({ contentDir: root, client, logger: { log() {} } });
		assert.equal(result.changed, false);
		assert.equal(called, false);
	});
});
