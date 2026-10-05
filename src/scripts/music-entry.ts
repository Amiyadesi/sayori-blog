import type { Component } from "svelte";

// The entry and article buttons keep the same player across routes and languages.
let player: ReturnType<typeof import("svelte").mount> | undefined;
let store: typeof import("../stores/musicPlayerStore").musicPlayerStore | undefined;
let unmount: typeof import("svelte").unmount | undefined;
let loading: Promise<void> | undefined;
let revision = 0;

async function openPlayer(expand = true): Promise<void> {
	const version = revision;
	if (!loading) {
		loading = (async () => {
			const existingStyles = new Set(document.head.querySelectorAll("link[rel=stylesheet], style"));
			const [runtime, { default: Player }, module] = await Promise.all([
				import("svelte"),
				import("../components/widgets/music-player/MusicPlayer.svelte"),
				import("../stores/musicPlayerStore"),
			]);
			if (version !== revision) throw new Error("Music loading cancelled");
			store = module.musicPlayerStore;
			unmount = runtime.unmount;
			const target = document.querySelector("#desk-music-host");
			if (!target) throw new Error("Missing music host");
			// Keep the lazy player CSS with its persisted host when Astro swaps the head.
			for (const style of document.head.querySelectorAll("link[rel=stylesheet], style")) {
				if (!existingStyles.has(style)) target.parentElement!.append(style);
			}
			// Astro exposes .svelte imports as SSR components to TypeScript.
			player = runtime.mount(Player as unknown as Component, { target });
			await runtime.tick();
			await store.initialize();
			if (version !== revision) throw new Error("Music loading cancelled");
		})().catch(error => {
			if (version === revision) closePlayer();
			throw error;
		});
	}
	await loading;
	if (version !== revision) return;
	if (expand && store && !store.getState().isExpanded) store.toggleExpanded();
}

function closePlayer(): void {
	revision++;
	const previous = player; player = undefined; loading = undefined;
	if (store) {
		store.pause();
		if (store.getState().isExpanded) store.toggleExpanded();
		store.destroy();
	}
	if (previous && unmount) void unmount(previous);
}

const scope = globalThis as typeof globalThis & {
	__sayoriMusicEntry?: { open: typeof openPlayer; close: typeof closePlayer };
};
scope.__sayoriMusicEntry ??= { open: openPlayer, close: closePlayer };
export const openMusicPlayer = scope.__sayoriMusicEntry.open;
export const closeMusicPlayer = scope.__sayoriMusicEntry.close;
