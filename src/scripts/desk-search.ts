export {};
type Pagefind = Window["pagefind"] & { init(): Promise<void>; destroy(): Promise<void> };
let pagefindPromise: Promise<Pagefind> | undefined;
let indexLocale = "";
let initialization = Promise.resolve();
let cleanup: (() => void) | undefined;

async function loadIndex(locale: string) {
	const path = "/pagefind/pagefind.js";
	pagefindPromise ??= import(/* @vite-ignore */ path).catch(error => {
		pagefindPromise = undefined;
		throw error;
	});
	const pagefind = await pagefindPromise!;
	const ready = initialization.then(async () => {
		if (document.documentElement.lang !== locale) throw new DOMException("Search language changed", "AbortError");
		if (indexLocale === locale) return;
		if (indexLocale) await pagefind.destroy();
		indexLocale = "";
		await pagefind.init();
		indexLocale = locale;
	});
	// A failed initialization is shown by the caller; a later retry may initialize again.
	initialization = ready.catch(() => {});
	await ready;
	return pagefind;
}

function bindSearch() {
	cleanup?.();
	const dialog = document.querySelector<HTMLDialogElement>("#desk-search");
	if (!dialog) return;
	const input = dialog.querySelector<HTMLInputElement>("input")!;
	const status = dialog.querySelector<HTMLElement>(".search-status")!;
	const list = dialog.querySelector<HTMLUListElement>("ul")!;
	const trigger = document.querySelector<HTMLButtonElement>("[data-search-open]")!;
	const labels = JSON.parse(dialog.dataset.labels!) as Record<string, string>;
	const locale = dialog.dataset.locale!;
	const lifecycle = new AbortController();
	const options = { signal: lifecycle.signal };
	let revision = 0;
	let timer: ReturnType<typeof setTimeout>;
	const isCurrent = (id: number) => !lifecycle.signal.aborted && dialog.open && revision === id;
	function failure(error: unknown) {
		console.error("Search unavailable", error);
		const retry = document.createElement("button");
		retry.type = "button";
		retry.textContent = labels.retry;
		retry.addEventListener("click", () => void search(), options);
		status.replaceChildren(retry);
	}
	async function search() {
		clearTimeout(timer);
		const id = ++revision;
		const term = input.value.trim();
		list.replaceChildren();
		status.textContent = term ? labels.busy : "";
		try {
			const pagefind = await loadIndex(locale);
			if (!isCurrent(id) || !term) return;
			const response = await pagefind.search(term, { filters: { locale } });
			const results = await Promise.all(response.results.slice(0, 20).map(item => item.data()));
			if (!isCurrent(id)) return;
			const items = results.map(result => {
				const item = document.createElement("li");
				const link = document.createElement("a");
				const title = document.createElement("strong");
				const excerpt = document.createElement("p");
				link.href = result.url;
				title.textContent = result.meta.title;
				// Pagefind escapes excerpt text before adding its own <mark> elements.
				excerpt.innerHTML = result.excerpt;
				link.append(title, excerpt);
				item.append(link);
				return item;
			});
			list.replaceChildren(...items);
			status.textContent = results.length ? "" : labels.empty;
		} catch (error) {
			if (isCurrent(id)) failure(error);
		}
	}
	trigger.addEventListener("click", () => {
		dialog.showModal();
		input.focus();
		void search();
	}, options);
	dialog.querySelector("[data-search-close]")!.addEventListener("click", () => dialog.close(), options);
	dialog.addEventListener("close", () => {
		clearTimeout(timer);
		revision++;
		trigger.focus({ preventScroll: true });
	}, options);
	dialog.querySelector("form")!.addEventListener("submit", event => {
		event.preventDefault();
		void search();
	}, options);
	input.addEventListener("input", () => {
		clearTimeout(timer);
		revision++;
		status.textContent = input.value.trim() ? labels.busy : "";
		list.replaceChildren();
		timer = setTimeout(search, 180);
	}, options);
	cleanup = () => {
		lifecycle.abort();
		clearTimeout(timer);
		revision++;
		if (dialog.open) dialog.close();
	};
}

const scope = window as typeof window & { __sayoriDeskSearchBound?: boolean };
if (!scope.__sayoriDeskSearchBound) {
	scope.__sayoriDeskSearchBound = true;
	bindSearch();
	document.addEventListener("astro:page-load", bindSearch);
	document.addEventListener("astro:before-swap", () => cleanup?.());
}
