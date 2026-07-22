import {
	EFFECTIVE_READ_PROGRESS,
	EFFECTIVE_READ_VISIBLE_MS,
	EffectiveReadGate,
	calculateArticleProgress,
	readCampaignAttribution,
} from "../utils/effective-read";

interface UmamiClient {
	track: (
		eventName: string,
		data?: Record<string, string | number>,
	) => void | Promise<unknown>;
}

interface TrackingWindow extends Window {
	umami?: UmamiClient;
	__sayoriEffectiveReadCleanup?: () => void;
}

const TRACKING_INTERVAL_MS = 1_000;

function currentArticle() {
	const container = document.querySelector<HTMLElement>(
		'#post-container[data-effective-read="true"]',
	);
	const content = container?.querySelector<HTMLElement>(".markdown-content");
	if (!container || !content) return null;
	return {
		container,
		content,
		postId: container.dataset.postId || window.location.pathname,
	};
}

function startPageSession(): () => void {
	const article = currentArticle();
	if (!article) return () => {};
	const { content, postId } = article;

	const gate = new EffectiveReadGate(
		document.visibilityState === "visible",
		performance.now(),
	);

	function updateProgress() {
		const rect = content.getBoundingClientRect();
		gate.updateProgress(
			calculateArticleProgress({
				scrollY: window.scrollY,
				viewportHeight: window.innerHeight,
				contentTop: rect.top + window.scrollY,
				contentHeight: Math.max(rect.height, content.scrollHeight),
			}),
		);
	}

	function deliverIfQualified() {
		const now = performance.now();
		if (!gate.isQualified(now)) return;
		const umami = (window as TrackingWindow).umami;
		if (!umami?.track) return;

		gate.markDelivered();
		const attribution = readCampaignAttribution(window.location.href);
		const data: Record<string, string | number> = {
			path: window.location.pathname,
			post_id: postId.slice(0, 160),
			visible_seconds: EFFECTIVE_READ_VISIBLE_MS / 1_000,
			progress_percent: EFFECTIVE_READ_PROGRESS * 100,
		};
		for (const [key, value] of Object.entries(attribution)) {
			if (value) data[key] = value;
		}

		try {
			const result = umami.track("effective_read", data);
			if (result instanceof Promise) result.catch(() => {});
		} catch {
			// Analytics must never interrupt reading.
		}
	}

	function evaluate() {
		updateProgress();
		deliverIfQualified();
	}

	function handleVisibilityChange() {
		gate.setVisible(
			document.visibilityState === "visible",
			performance.now(),
		);
		if (document.visibilityState === "visible") evaluate();
	}

	window.addEventListener("scroll", evaluate, { passive: true });
	document.addEventListener("visibilitychange", handleVisibilityChange);
	const interval = window.setInterval(evaluate, TRACKING_INTERVAL_MS);
	evaluate();

	return () => {
		window.clearInterval(interval);
		window.removeEventListener("scroll", evaluate);
		document.removeEventListener("visibilitychange", handleVisibilityChange);
	};
}

export function startEffectiveReadTracking(): () => void {
	const trackingWindow = window as TrackingWindow;
	trackingWindow.__sayoriEffectiveReadCleanup?.();

	let stopPageSession = startPageSession();
	const restart = () => {
		window.setTimeout(() => {
			stopPageSession();
			stopPageSession = startPageSession();
		}, 0);
	};

	document.addEventListener("swup:pageView", restart);
	const cleanup = () => {
		stopPageSession();
		document.removeEventListener("swup:pageView", restart);
		if (trackingWindow.__sayoriEffectiveReadCleanup === cleanup) {
			delete trackingWindow.__sayoriEffectiveReadCleanup;
		}
	};
	trackingWindow.__sayoriEffectiveReadCleanup = cleanup;
	return cleanup;
}
