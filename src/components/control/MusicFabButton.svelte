<script lang="ts">
	import Icon from "@iconify/svelte";
	import { onMount } from "svelte";

	import type { MusicPlayerState } from "@/stores/musicPlayerStore";
	import { isEnglishSite } from "@/utils/site-locale";

	let state: Partial<MusicPlayerState> = {};
	let opening = false;
	let openError = false;

	async function toggleControlCenter() {
		if (opening) return;
		opening = true;
		openError = false;
		try {
			const { musicPlayerStore } = await import("@/stores/musicPlayerStore");
			await musicPlayerStore.initialize();
			musicPlayerStore.toggleExpanded();
		} catch (error) {
			openError = true;
			console.error("[MusicPlayer] Failed to open player", error);
		} finally {
			opening = false;
		}
	}

	$: currentSongTitle =
		state.currentSong?.title ||
		(isEnglishSite ? "Music player" : "音乐控制中心");
	$: ariaLabel = openError
		? (isEnglishSite ? "Player unavailable. Try again" : "播放器加载失败，请重试")
		: state.isExpanded
		? `${isEnglishSite ? "Collapse music player" : "收起音乐控制中心"}: ${currentSongTitle}`
		: `${isEnglishSite ? "Open music player" : "打开音乐控制中心"}: ${currentSongTitle}`;
	$: statusIcon = state.isLoading
		? "svg-spinners:90-ring-with-bg"
		: "material-symbols:music-note-rounded";

	onMount(() => {
		const onState = (event: Event) => {
			state = (event as CustomEvent<MusicPlayerState>).detail;
		};
		window.addEventListener("music-sidebar:state", onState);
		return () => window.removeEventListener("music-sidebar:state", onState);
	});
</script>

<button
	type="button"
	class:active={state.isExpanded}
	class:playing={state.isPlaying}
	class:loading={state.isLoading}
	class="music-fab btn-card"
	aria-label={ariaLabel}
	title={ariaLabel}
	aria-busy={opening}
	onclick={toggleControlCenter}
>
	{#if openError}<span class="sr-only" role="status">{ariaLabel}</span>{/if}
	<span class="music-fab__icon" aria-hidden="true">
		<Icon icon={statusIcon} />
	</span>

	{#if state.isPlaying}
		<span class="music-fab__dot" aria-hidden="true"></span>
	{/if}
</button>

<style>
	.music-fab {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: var(--fab-button-size, 3rem);
		height: var(--fab-button-size, 3rem);
		min-width: 0;
		min-height: 0;
		padding: 0.25rem;
		border: 1px solid rgba(148, 163, 184, 0.45);
		border-radius: 1rem;
		cursor: pointer;
		color: var(--primary);
		pointer-events: auto;
		transition:
			transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
			box-shadow 0.3s ease,
			background 0.3s ease;
	}

	.music-fab:hover {
		box-shadow: var(--shadow-button);
	}

	.music-fab:active {
		transform: scale(0.94);
	}

	.music-fab.active {
		background: var(--btn-card-bg-active);
	}

	.music-fab__icon {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 1.5rem;
		line-height: 1;
	}

	.music-fab__dot {
		position: absolute;
		right: 0.38rem;
		bottom: 0.38rem;
		z-index: 2;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 999px;
		background: var(--primary);
		box-shadow: 0 0 0 2px var(--card-bg);
	}

	.music-fab.playing::after {
		content: "";
		position: absolute;
		inset: 0;
		border-radius: inherit;
		border: 1px solid color-mix(in srgb, var(--primary) 35%, transparent);
		animation: music-fab-pulse 1.8s ease-out infinite;
	}

	.music-fab.loading .music-fab__icon :global(svg) {
		font-size: 1.2rem;
	}

	:global(.dark) .music-fab {
		border: 1px solid rgba(255, 255, 255, 0.15);
	}

	:global(.dark) .music-fab:hover {
		box-shadow: var(--shadow-button-dark);
	}

	@keyframes music-fab-pulse {
		0% {
			opacity: 0;
			transform: scale(0.92);
		}
		30% {
			opacity: 0.75;
		}
		100% {
			opacity: 0;
			transform: scale(1.12);
		}
	}

	@media (max-width: 768px) {
		.music-fab {
			border-radius: 0.75rem;
		}

		.music-fab__icon {
			font-size: 1.4rem;
		}
	}

	@media (max-width: 480px) {
		.music-fab {
			border-radius: 0.5rem;
		}
	}
</style>
