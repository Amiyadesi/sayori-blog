interface GardenPreviewEntry {	slug: string;
	title: string;
	description: string;
	stage: "seedling" | "budding" | "evergreen";
	topicTitle: string;
	topicIcon: string;
	lastTended: string;
	updateCount: number;
}

const DATA_ELEMENT_ID = "garden-preview-data";
const LINK_SELECTOR = ".custom-md a[href]";
const SHOW_DELAY_MS = 180;
const HIDE_DELAY_MS = 120;

let card: HTMLElement | null = null;
let showTimer: number | undefined;
let hideTimer: number | undefined;
let activeAnchor: HTMLAnchorElement | null = null;

function readPreviewData(): Map<string, GardenPreviewEntry> {
	const map = new Map<string, GardenPreviewEntry>();
	const element = document.getElementById(DATA_ELEMENT_ID);
	if (!element?.textContent) return map;
	try {
		const entries = JSON.parse(element.textContent) as GardenPreviewEntry[];
		for (const entry of entries) {
			map.set(entry.slug, entry);
		}
	} catch {
		// The inline payload is produced by our own build; a parse failure means the
		// page is broken, so stay silent here and let the page render without previews.
	}
	return map;
}

function slugFromHref(rawHref: string): string {
	const href = rawHref.split(/[?#]/)[0];
	const match = href.match(/(?:^|\/)posts\/(.+?)\/?$/);
	if (!match) return "";
	return match[1]
		.normalize("NFKD")
		.toLowerCase()
		.trim()
		.replace(/[.\u0027\u2019]/g, "")
		.replace(/[^\p{Letter}\p{Number}]+/gu, "-")
		.replace(/^-+|-+$/g, "");
}

function ensureCard(): HTMLElement {
	if (card) return card;
	const element = document.createElement("div");
	element.className = "garden-preview-card";
	element.setAttribute("role", "tooltip");
	element.hidden = true;
	document.body.appendChild(element);
	card = element;
	return element;
}

function renderCard(entry: GardenPreviewEntry): string {
	const stageIcon =
		entry.stage === "evergreen" ? "🌲" : entry.stage === "budding" ? "🌿" : "🌱";
	const revisions = entry.updateCount > 0 ? `${entry.updateCount}×` : "";
	return `
		<p class="garden-preview-card__meta">
			<span aria-hidden="true">${entry.topicIcon}</span>
			<span>${escapeHtml(entry.topicTitle)}</span>
			<span class="garden-preview-card__stage">
				<span aria-hidden="true">${stageIcon}</span>
				<span>${entry.lastTended}</span>
			</span>
			${revisions ? `<span>${revisions}</span>` : ""}
		</p>
		<p class="garden-preview-card__title">${escapeHtml(entry.title)}</p>
		${entry.description ? `<p class="garden-preview-card__desc">${escapeHtml(entry.description)}</p>` : ""}
	`;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function positionCard(element: HTMLElement, anchor: DOMRect): void {
	element.hidden = false;
	element.style.left = "0px";
	element.style.top = "0px";
	const rect = element.getBoundingClientRect();
	const gap = 10;
	const viewportPadding = 12;

	let left = anchor.left;
	if (left + rect.width > window.innerWidth - viewportPadding) {
		left = window.innerWidth - viewportPadding - rect.width;
	}
	if (left < viewportPadding) left = viewportPadding;

	let top = anchor.bottom + gap;
	if (top + rect.height > window.innerHeight - viewportPadding) {
		const above = anchor.top - gap - rect.height;
		top = above >= viewportPadding ? above : window.innerHeight - viewportPadding - rect.height;
	}
	if (top < viewportPadding) top = viewportPadding;

	element.style.left = `${Math.round(left)}px`;
	element.style.top = `${Math.round(top)}px`;
}

function hideCard(): void {
	window.clearTimeout(showTimer);
	window.clearTimeout(hideTimer);
	activeAnchor = null;
	if (card) card.hidden = true;
}

function scheduleHide(): void {
	window.clearTimeout(showTimer);
	window.clearTimeout(hideTimer);
	hideTimer = window.setTimeout(hideCard, HIDE_DELAY_MS);
}

let previews = new Map<string, GardenPreviewEntry>();
let listenersBound = false;

function refreshPreviews(): void {
	previews = readPreviewData();
}

function bind(): void {
	if (window.matchMedia("(hover: none)").matches) return;
	refreshPreviews();
	if (listenersBound) return;
	listenersBound = true;

	document.addEventListener("mouseover", (event) => {
		if (!(event.target instanceof Element)) return;
		const anchor = event.target.closest<HTMLAnchorElement>(LINK_SELECTOR);
		if (!anchor) return;
		if (anchor.dataset.gardenPreview === "off") return;

		const slug = slugFromHref(anchor.getAttribute("href") || "");
		const entry = slug ? previews.get(slug) : undefined;
		if (!entry) return;
		if (anchor === activeAnchor) {
			window.clearTimeout(hideTimer);
			return;
		}

		window.clearTimeout(hideTimer);
		window.clearTimeout(showTimer);
		showTimer = window.setTimeout(() => {
			if (!anchor.isConnected) return;
			activeAnchor = anchor;
			const element = ensureCard();
			element.innerHTML = renderCard(entry);
			positionCard(element, anchor.getBoundingClientRect());
		}, SHOW_DELAY_MS);
	});

	document.addEventListener("mouseout", (event) => {
		if (!(event.target instanceof Element)) return;
		const anchor = event.target.closest(LINK_SELECTOR);
		if (anchor && anchor === activeAnchor) scheduleHide();
	});

	document.addEventListener("focusin", (event) => {
		if (event.target instanceof HTMLAnchorElement && event.target.matches(LINK_SELECTOR)) {
			hideCard();
		}
	});

	window.addEventListener("scroll", () => {
		if (activeAnchor) hideCard();
	}, { passive: true });
}

function setup(): void {
	hideCard();
	bind();
}

setup();
document.addEventListener("astro:before-swap", hideCard);
document.addEventListener("astro:page-load", () => {
	hideCard();
	refreshPreviews();
	bind();
});

export {};
