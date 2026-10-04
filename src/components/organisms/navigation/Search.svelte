<script lang="ts">
	import { onDestroy } from "svelte";
	import type { SearchResult } from "@/global";
	import type { SiteLocale } from "@utils/site-locale";
	let { locale }: { locale: SiteLocale } = $props();
	const isEnglishSite = locale === "en";
	let dialog: HTMLDialogElement;
	let input: HTMLInputElement;
	let query = $state("");
	let results: SearchResult[] = $state([]);
	let busy = $state(false);
	let failed = $state(false);
	let searched = $state(false);
	let revision = 0;
	let timer: ReturnType<typeof setTimeout>;
	let index: Window["pagefind"] | undefined;
	let loadingIndex: Promise<Window["pagefind"]> | undefined;
	const label = isEnglishSite ? "Search" : "搜索";
	async function loadIndex() {
		if (index) return index;
		if (!loadingIndex) {
			const path = "/pagefind/pagefind.js";
			loadingIndex = import(/* @vite-ignore */ path).then(module => {
				index = module as Window["pagefind"];
				return index;
			}).catch(error => { loadingIndex = undefined; throw error; });
		}
		return loadingIndex;
	}
	function open() { dialog.showModal(); input.focus(); }
	async function search() {
		const id = ++revision;
		const term = query.trim();
		results = []; failed = false; searched = false;
		if (!term) { busy = false; return; }
		busy = true;
		try {
			const pagefind = await loadIndex();
			const response = await pagefind.search(term, { filters: { locale } });
			const matches = await Promise.all(response.results.slice(0, 20).map(item => item.data()));
			if (id === revision) { results = matches; searched = true; }
		} catch (error) {
			if (id === revision) failed = true;
			console.error("Search unavailable", error);
		} finally { if (id === revision) busy = false; }
	}
	function schedule() {
		clearTimeout(timer); revision++; busy = Boolean(query.trim()); searched = false;
		timer = setTimeout(search, 180);
	}
	onDestroy(() => { clearTimeout(timer); revision++; });
</script>
<button type="button" class="desk-search-button" onclick={open} aria-label={label}>
	<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
	<span>{label}</span>
</button>
<dialog bind:this={dialog} class="desk-search" aria-label={label}>
	<form onsubmit={event => { event.preventDefault(); void search(); }}>
		<label for="desk-search-input">{isEnglishSite ? "Search the notebook" : "在书桌上找一找"}</label>
		<button type="button" class="search-close" onclick={() => dialog.close()} aria-label={isEnglishSite ? "Close" : "关闭"}>×</button>
		<input id="desk-search-input" bind:this={input} bind:value={query} oninput={schedule} placeholder={isEnglishSite ? "Title or keyword…" : "标题或关键词…"} type="search" autocomplete="off" />
	</form>
	<div aria-live="polite" class="search-status">
		{#if busy}{isEnglishSite ? "Searching…" : "正在查找…"}
		{:else if failed}<button onclick={search}>{isEnglishSite ? "Search unavailable. Retry" : "搜索加载失败，点击重试"}</button>
		{:else if searched && !results.length}{isEnglishSite ? "No matching posts." : "没有找到相关文章。"}{/if}
	</div>
	<ul>{#each results as result}<li><a href={result.url}><strong>{result.meta.title}</strong><p>{@html result.excerpt}</p></a></li>{/each}</ul>
</dialog>
