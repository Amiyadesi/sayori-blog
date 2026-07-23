import { copyTextWithFeedback } from "@utils/copy-feedback";

type PostInteractionData = {
	path: string;
	likes?: number | string | null;
	rewardClicks?: number | string | null;
	viewerLiked?: unknown;
};

type ShareSuccessDetail = {
	url?: string;
	target?: string;
};

function isPostInteractionData(value: unknown): value is PostInteractionData {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as { path?: unknown }).path === "string"
	);
}

export function initPostEngagement(): void {
	const roots = document.querySelectorAll<HTMLElement>("[data-post-engagement]");
	roots.forEach((root) => {
		if (root.dataset.bound === "true") {return;}
		root.dataset.bound = "true";

		const path = root.dataset.path || window.location.pathname;
		const url = root.dataset.url || window.location.href;
		const title = root.dataset.title || document.title;
		const statsFailedText = root.dataset.statsFailedText || "Stats unavailable";
		const copyFailedText = root.dataset.copyFailedText || "Copy failed";
		const status = root.querySelector<HTMLElement>("[data-engagement-status]");
		const likeButton = root.querySelector<HTMLButtonElement>(".post-like-button");
		const likeLabel = root.querySelector<HTMLElement>("[data-like-label]");
		const likeCount = root.querySelector<HTMLElement>("[data-like-count]");
		const rewardCount = root.querySelector<HTMLElement>("[data-reward-count]");
		const nativeShare = root.querySelector<HTMLButtonElement>("[data-native-share]");
		const copyFallback = root.querySelector<HTMLElement>("[data-copy-fallback]");
		const copyFallbackInput = root.querySelector<HTMLInputElement>(
			"[data-copy-fallback-input]",
		);
		const promoteLink = root.querySelector<HTMLElement>("[data-promote-post]");
		const lifecycle = new AbortController();
		let statusTimer = 0;

		if (typeof navigator.share === "function" && nativeShare) {
			nativeShare.hidden = false;
		}

		function numberText(value: unknown): string {
			return String(Number(value || 0));
		}

		function showStatus(message: string, duration = 2600): void {
			if (!status) {return;}
			window.clearTimeout(statusTimer);
			status.textContent = message;
			status.hidden = false;
			statusTimer = window.setTimeout(() => {
				status.hidden = true;
			}, duration);
		}

		function update(data: unknown): void {
			if (!isPostInteractionData(data) || data.path !== path) {return;}
			if (likeCount) {likeCount.textContent = numberText(data.likes);}
			if (rewardCount) {rewardCount.textContent = numberText(data.rewardClicks);}
			if (likeButton) {
				const liked = Boolean(data.viewerLiked);
				likeButton.classList.toggle("is-liked", liked);
				likeButton.setAttribute("aria-pressed", liked ? "true" : "false");
				if (likeLabel) {
					likeLabel.textContent = liked
						? root.dataset.likedText || "Liked"
						: root.dataset.likeText || "Like";
				}
			}
		}

		async function loadCounts(): Promise<void> {
			try {
				const response = await fetch(
					`/api/post-interactions?path=${encodeURIComponent(path)}`,
					{ headers: { accept: "application/json" }, credentials: "same-origin" },
				);
				if (!response.ok) {throw new Error(`HTTP ${response.status}`);}
				update(await response.json());
			} catch {
				showStatus(statsFailedText);
			}
		}

		async function track(action: string, target: string, quiet = false): Promise<void> {
			try {
				const response = await fetch("/api/post-interactions", {
					method: "POST",
					credentials: "same-origin",
					keepalive: action !== "like",
					headers: { "content-type": "application/json", accept: "application/json" },
					body: JSON.stringify({ path, action, target }),
				});
				if (!response.ok) {throw new Error(`HTTP ${response.status}`);}
				update(await response.json());
			} catch {
				if (!quiet) {showStatus(statsFailedText);}
			}
		}

		function showManualCopyFallback(): void {
			if (!copyFallback || !copyFallbackInput) {return;}
			copyFallback.hidden = false;
			copyFallbackInput.focus();
			copyFallbackInput.select();
			showStatus(copyFailedText, 5000);
		}

		root.addEventListener("click", (event) => {
			const target = event.target;
			if (!(target instanceof Element)) {return;}

			const likeTrigger = target.closest("[data-post-action='like']");
			if (likeTrigger) {
				event.preventDefault();
				void track("like", "like");
				return;
			}

			const rewardTrigger = target.closest<HTMLElement>("[data-post-action='reward']");
			if (rewardTrigger) {
				void track("reward", rewardTrigger.dataset.postTarget || "sponsor", true);
				return;
			}

			if (target.closest("[data-copy-share]")) {
				event.preventDefault();
				void copyTextWithFeedback(url)
					.then(() => track("share", "copy", true))
					.catch(showManualCopyFallback);
				return;
			}

			if (target.closest("[data-native-share]")) {
				event.preventDefault();
				if (typeof navigator.share !== "function") {return;}
				void navigator
					.share({ title, url })
					.then(() => track("share", "native", true))
					.catch((error: unknown) => {
						if (error instanceof DOMException && error.name === "AbortError") {return;}
						showStatus(statsFailedText);
					});
			}
		});

		const shareSuccess = (event: Event): void => {
			if (!(event instanceof CustomEvent)) {return;}
			const detail = (event.detail || {}) as ShareSuccessDetail;
			if (detail.url !== url || !detail.target) {return;}
			void track("share", detail.target, true);
		};
		document.addEventListener("sayori:share-success", shareSuccess, {
			signal: lifecycle.signal,
		});
		document.addEventListener("swup:contentReplaced", () => lifecycle.abort(), {
			once: true,
			signal: lifecycle.signal,
		});

		void fetch("/api/admin/me", {
			headers: { accept: "application/json" },
			credentials: "same-origin",
		})
			.then((response) => {
				if (response.ok && promoteLink) {promoteLink.hidden = false;}
			})
			.catch(() => {});

		void loadCounts();
	});
}
