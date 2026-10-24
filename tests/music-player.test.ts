import assert from "node:assert/strict";
import { test } from "node:test";

import { musicPlayerStore } from "../src/stores/musicPlayerStore";

class AudioStub extends EventTarget {
	private source = "";
	sources: string[] = [];
	get src() {
		return this.source;
	}
	set src(value: string) {
		this.sources.push(value);
		this.source = value;
	}
	preload = "";
	volume = 1;
	muted = false;
	paused = true;
	currentTime = 0;
	duration = 180;
	playCount = 0;
	load() {}
	removeAttribute(name: string) {
		assert.equal(name, "src");
		this.source = "";
	}
	async play() {
		this.playCount++;
		this.paused = false;
		this.dispatchEvent(new Event("play"));
	}
	pause() {
		if (this.paused) return;
		this.paused = true;
		this.dispatchEvent(new Event("pause"));
	}
}

test("music stays paused when late media data arrives, and reopens idle after closing", async () => {
	const window = Object.assign(new EventTarget(), {
		location: { search: "?music=netease" },
	});
	const saved = new Map<string, string>();
	Object.assign(globalThis, {
		window,
		document: new EventTarget(),
		Audio: AudioStub,
		localStorage: {
			getItem: (key: string) => saved.get(key) ?? null,
			setItem: (key: string, value: string) => saved.set(key, value),
		},
	});
	try {
		await musicPlayerStore.initialize();
		const audio = musicPlayerStore.getAudio() as unknown as AudioStub;
		assert.equal(
			audio.src,
			"",
			"opening the player must not start media requests",
		);
		musicPlayerStore.playTrack({
			id: 99,
			title: "Test",
			artist: "Test",
			cover: "",
			url: "/test.mp3",
			duration: 180,
		});
		assert.equal(audio.src, "/test.mp3");
		musicPlayerStore.pause();
		audio.dispatchEvent(new Event("loadeddata"));
		assert.equal(
			audio.playCount,
			0,
			"late data must not undo the reader's pause",
		);
		assert.equal(musicPlayerStore.getState().willAutoPlay, false);
		musicPlayerStore.play();
		assert.equal(musicPlayerStore.getState().isPlaying, true);
		musicPlayerStore.playTrack({
			id: 100,
			title: "Fallback",
			artist: "Test",
			cover: "",
			url: "/fallback.mp3",
			youtube: "CAL4WMpBNs0",
			duration: 180,
		});
		audio.dispatchEvent(new Event("loadeddata"));
		audio.dispatchEvent(new Event("error"));
		assert.equal(musicPlayerStore.getState().externalProvider, "youtube");
		assert.equal(
			musicPlayerStore.getState().isPlaying,
			true,
			"a real playback error can still switch to the existing fallback",
		);
		musicPlayerStore.playTrack({
			id: 100,
			title: "Embed",
			artist: "Test",
			cover: "",
			url: "",
			youtube: "CAL4WMpBNs0",
			duration: 180,
		});
		assert.equal(musicPlayerStore.getState().externalProvider, "youtube");
		musicPlayerStore.destroy();
		assert.ok(
			audio.sources.every(Boolean),
			"clearing audio must remove src, not load the current document as media",
		);
		assert.equal(musicPlayerStore.getState().isPlaying, false);
		assert.equal(musicPlayerStore.getState().isLoading, false);
		assert.equal(musicPlayerStore.getState().willAutoPlay, false);
		assert.equal(musicPlayerStore.getState().externalPlayerUrl, "");
		await musicPlayerStore.initialize();
		assert.equal(musicPlayerStore.getAudio()?.src, "");
		assert.equal(musicPlayerStore.getState().isPlaying, false);
	} finally {
		musicPlayerStore.destroy();
		for (const key of ["window", "document", "Audio", "localStorage"])
			Reflect.deleteProperty(globalThis, key);
	}
});
