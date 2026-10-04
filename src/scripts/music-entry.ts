import type { Component } from "svelte";

// The light entry and article track buttons share one player per document.
let player: ReturnType<typeof import("svelte").mount> | undefined;
let store: typeof import("../stores/musicPlayerStore").musicPlayerStore | undefined;
let unmount: typeof import("svelte").unmount | undefined;
let loading: Promise<void> | undefined;
let revision = 0;

export async function openMusicPlayer(expand = true): Promise<void> {
	const version = revision;
	if (!loading) {
		loading = (async () => {
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
			// Astro exposes .svelte imports as SSR components to TypeScript.
			player = runtime.mount(Player as unknown as Component, { target });
			await runtime.tick();
			await store.initialize();
			if (version !== revision) throw new Error("Music loading cancelled");
		})().catch(error => {
			if (version === revision) closeMusicPlayer();
			throw error;
		});
	}
	await loading;
	if (version !== revision) return;
	if (expand && store && !store.getState().isExpanded) store.toggleExpanded();
}

export function closeMusicPlayer(): void {
	revision++;
	const previous = player; player = undefined; loading = undefined;
	if (store) {
		store.pause();
		if (store.getState().isExpanded) store.toggleExpanded();
		store.destroy();
	}
	if (previous && unmount) void unmount(previous);
}
