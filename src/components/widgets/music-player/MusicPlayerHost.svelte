<script lang="ts">
	import { onMount } from "svelte";
	import type { MusicPlayerState } from "@/stores/musicPlayerStore";

	export let eager = false;
	let Player: typeof import("./MusicPlayer.svelte").default | undefined;
	let loading = false;
	let loadError = false;
	let retryLabel = "";

	async function loadPlayer() {
		if (Player || loading) return;
		loading = true;
		loadError = false;
		try {
			Player = (await import("./MusicPlayer.svelte")).default;
		} catch (error) {
			loadError = true;
			console.error("[MusicPlayer] Failed to load controls", error);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		const lang = document.documentElement.lang;
		retryLabel = lang.startsWith("en")
			? "Player unavailable. Retry"
			: lang === "zh-Hant" ? "播放器載入失敗，重試" : "播放器加载失败，重试";
		const onState = (event: Event) => {
			const state = (event as CustomEvent<MusicPlayerState>).detail;
			if (state.isExpanded || state.isPlaying || state.isLoading) void loadPlayer();
		};
		window.addEventListener("music-sidebar:state", onState);
		if (eager) void loadPlayer();
		return () => window.removeEventListener("music-sidebar:state", onState);
	});
</script>

{#if Player}
	<svelte:component this={Player} />
{/if}
{#if loadError}
	<button class="fixed bottom-24 right-4 z-[60] card-base p-3" onclick={loadPlayer}>
		{retryLabel}
	</button>
{/if}
