export {};
let currentContainer: HTMLElement | null = null;
let cleanup: (() => void) | undefined;

function bindComments() {
	const container = document.getElementById("twikoo-container");
	if (container === currentContainer) return;
	cleanup?.();
	currentContainer = container;
	if (!container) return;
	const lifecycle = new AbortController();
	const signal = lifecycle.signal;
	const mount = container.querySelector<HTMLElement>("#tcomment")!;
	const options = JSON.parse(container.dataset.twikooOptions!);
	const traditional = document.documentElement.lang === "zh-Hant";
	let loading = false;
	let initialized = false;
	let disposeRuntime: (() => void) | undefined;
	const isCurrent = () => !signal.aborted && document.getElementById("twikoo-container") === container;
	async function start() {
		if (!isCurrent() || loading || initialized) return;
		loading = true;
		mount.textContent = options.isEnglishSite ? "Loading comments…" : traditional ? "正在載入評論…" : "正在加载评论…";
		try {
			const { mountTwikoo } = await import("./twikoo-runtime.js");
			if (!isCurrent()) return;
			disposeRuntime = mountTwikoo(container, options);
			initialized = true;
			observer.disconnect();
		} catch (error) {
			if (!isCurrent()) return;
			console.error("Comment module unavailable", error);
			const retry = document.createElement("button");
			retry.type = "button";
			retry.dataset.commentLoad = "";
			retry.textContent = options.isEnglishSite ? "Comments unavailable. Retry" : traditional ? "評論載入失敗，點此重試" : "评论加载失败，点击重试";
			mount.replaceChildren(retry);
		} finally { loading = false; }
	}
	const observer = new IntersectionObserver(entries => {
		if (entries.some(entry => entry.isIntersecting)) void start();
	}, { rootMargin: "320px 0px" });
	observer.observe(container);
	const isCommentHash = (hash: string) => hash === "#comments" || hash === "#twikoo-container";
	if (isCommentHash(location.hash)) void start();
	window.addEventListener("hashchange", () => {
		if (isCommentHash(location.hash)) void start();
	}, { signal });
	document.addEventListener("click", event => {
		if (!(event.target instanceof Element)) return;
		if (container.contains(event.target) && event.target.closest("[data-comment-load]")) {
			void start();
			return;
		}
		const link = event.target.closest<HTMLAnchorElement>("a[href]");
		if (!link) return;
		const target = new URL(link.href, location.href);
		if (target.origin === location.origin && target.pathname === location.pathname && isCommentHash(target.hash)) void start();
	}, { signal });
	cleanup = () => {
		lifecycle.abort();
		observer.disconnect();
		disposeRuntime?.();
		currentContainer = null;
	};
}

const scope = window as typeof window & { __sayoriCommentsLoaderBound?: boolean };
if (!scope.__sayoriCommentsLoaderBound) {
	scope.__sayoriCommentsLoaderBound = true;
	bindComments();
	document.addEventListener("astro:page-load", bindComments);
	document.addEventListener("astro:before-swap", () => cleanup?.());
}
