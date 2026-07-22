export const EFFECTIVE_READ_VISIBLE_MS = 45_000;
export const EFFECTIVE_READ_PROGRESS = 0.5;

export interface ArticleProgressInput {
	scrollY: number;
	viewportHeight: number;
	contentTop: number;
	contentHeight: number;
}

export interface CampaignAttribution {
	source?: string;
	medium?: string;
	campaign?: string;
	content?: string;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

export class EffectiveReadGate {
	private accumulatedVisibleMs = 0;
	private visibleSince: number | null;
	private delivered = false;
	progress = 0;

	constructor(visible: boolean, now: number) {
		this.visibleSince = visible ? now : null;
	}

	setVisible(visible: boolean, now: number): void {
		if (visible && this.visibleSince === null) {
			this.visibleSince = now;
			return;
		}
		if (!visible && this.visibleSince !== null) {
			this.accumulatedVisibleMs += Math.max(0, now - this.visibleSince);
			this.visibleSince = null;
		}
	}

	visibleMilliseconds(now: number): number {
		if (this.visibleSince === null) return this.accumulatedVisibleMs;
		return this.accumulatedVisibleMs + Math.max(0, now - this.visibleSince);
	}

	updateProgress(progress: number): void {
		if (!Number.isFinite(progress)) return;
		this.progress = Math.max(this.progress, clamp(progress, 0, 1));
	}

	isQualified(now: number): boolean {
		return (
			!this.delivered &&
			this.visibleMilliseconds(now) >= EFFECTIVE_READ_VISIBLE_MS &&
			this.progress >= EFFECTIVE_READ_PROGRESS
		);
	}

	markDelivered(): void {
		this.delivered = true;
	}
}

export function calculateArticleProgress(input: ArticleProgressInput): number {
	if (!Number.isFinite(input.contentHeight) || input.contentHeight <= 0) return 0;
	const readingEdge = input.scrollY + input.viewportHeight;
	return clamp(
		(readingEdge - input.contentTop) / input.contentHeight,
		0,
		1,
	);
}

function attributionValue(url: URL, key: string): string | undefined {
	const value = url.searchParams
		.get(key)
		?.normalize("NFKC")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 120);
	return value || undefined;
}

export function readCampaignAttribution(urlValue: string): CampaignAttribution {
	let url: URL;
	try {
		url = new URL(urlValue);
	} catch {
		return {};
	}
	return {
		source: attributionValue(url, "utm_source"),
		medium: attributionValue(url, "utm_medium"),
		campaign: attributionValue(url, "utm_campaign"),
		content: attributionValue(url, "utm_content"),
	};
}
