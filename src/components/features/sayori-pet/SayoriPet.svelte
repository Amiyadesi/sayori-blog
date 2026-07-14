<script lang="ts">
	import { onMount } from "svelte";

	type PetMode = "open" | "sleeping";

	const storageKey = "sayori-blog-pet-mode";
	const layoutVersionKey = "sayori-blog-pet-layout-version";
	const layoutVersion = "8-mobile-left";
	const spriteStatic = "/assets/pet/sayori-neutral.webp";
	const spriteAnimated = "/assets/pet/sayori-idle.gif";
	const lines = [
		"嘿嘿，我在这里哦。",
		"慢慢来，今天也不急。",
		"写不出来就先喝口水。",
		"我刚刚只是在发呆啦。",
		"你点我一下，我就醒一点。",
		"这一页看起来挺温柔的。",
		"累了也可以先停一下。",
		"别担心，我会帮你守着书桌。",
		"今天也把小事写下来吧。",
		"摸鱼可以，但要记得回来哦。",
		"我没有睡着，只是在省电。",
		"这里风很轻，适合慢慢看。",
		"你来啦，那我也精神一点。",
		"把难的事拆小一点就好。",
	];

	let mode: PetMode = "open";
	let lineIndex = 0;
	let isDragging = false;
	let hasMoved = false;
	let ready = false;
	let bubbleVisible = false;
	let isReacting = false;
	let isLeaving = false;
	let showTab = false;
	let hopKey = 0;
	let isAnimating = false;
	let petRef: HTMLDivElement | null = null;
	let pos = { x: 0, y: 0 };
	let dragOffset = { x: 0, y: 0 };
	let dragStart = { x: 0, y: 0 };
	let reactTimer: ReturnType<typeof setTimeout> | null = null;
	let bubbleTimer: ReturnType<typeof setTimeout> | null = null;
	let sleepTimer: ReturnType<typeof setTimeout> | null = null;
	let animTimer: ReturnType<typeof setTimeout> | null = null;

	$: currentSprite = isAnimating ? spriteAnimated : spriteStatic;

	const currentLine = () => lines[lineIndex % lines.length];

	function nextLine() {
		if (lines.length <= 1) return;
		const offset = 1 + Math.floor(Math.random() * (lines.length - 1));
		lineIndex = (lineIndex + offset) % lines.length;
	}

	function hop() {
		if (reactTimer) clearTimeout(reactTimer);
		if (animTimer) clearTimeout(animTimer);
		isReacting = true;
		isAnimating = true;
		hopKey += 1;
		reactTimer = setTimeout(() => {
			isReacting = false;
		}, 680);
		animTimer = setTimeout(() => {
			isAnimating = false;
		}, 1600);
	}

	function react() {
		nextLine();
		bubbleVisible = true;
		hop();
		if (bubbleTimer) clearTimeout(bubbleTimer);
		bubbleTimer = setTimeout(() => {
			bubbleVisible = false;
		}, 3200);
	}

	function sleep() {
		if (isLeaving) return;
		if (reactTimer) clearTimeout(reactTimer);
		if (bubbleTimer) clearTimeout(bubbleTimer);
		if (animTimer) clearTimeout(animTimer);
		bubbleVisible = false;
		isReacting = false;
		isAnimating = false;
		isLeaving = true;
		sleepTimer = setTimeout(() => {
			isLeaving = false;
			showTab = true;
			mode = "sleeping";
			localStorage.setItem(storageKey, mode);
		}, 760);
	}

	function wake() {
		showTab = false;
		bubbleVisible = false;
		isReacting = false;
		isLeaving = false;
		isAnimating = false;
		mode = "open";
		localStorage.setItem(storageKey, mode);
		pos = getDefaultPosition();
	}

	function isMobileViewport() {
		return window.matchMedia("(max-width: 768px)").matches;
	}

	function getDefaultPosition() {
		const width = petRef?.offsetWidth ?? (isMobileViewport() ? 130 : 160);
		const height = petRef?.offsetHeight ?? (isMobileViewport() ? 220 : 260);
		const defaultX = isMobileViewport() ? 14 : 24;
		const defaultY = isMobileViewport()
			? window.innerHeight - height - 104
			: window.innerHeight - height - 86;

		return clampPosition(defaultX, defaultY);
	}

	function handleImageError() {
		showTab = false;
		mode = "sleeping";
		localStorage.setItem(storageKey, mode);
	}

	function clampPosition(x: number, y: number) {
		const width = petRef?.offsetWidth ?? 160;
		const height = petRef?.offsetHeight ?? 260;
		return {
			x: Math.min(Math.max(12, x), window.innerWidth - width - 12),
			y: Math.min(Math.max(72, y), window.innerHeight - height - 12),
		};
	}

	function startDrag(event: PointerEvent) {
		if (
			event.target instanceof HTMLElement &&
			event.target.closest("button")
		)
			return;
		isDragging = true;
		hasMoved = false;
		petRef?.setPointerCapture(event.pointerId);
		const rect = petRef?.getBoundingClientRect();
		dragStart = {
			x: event.clientX,
			y: event.clientY,
		};
		dragOffset = {
			x: event.clientX - (rect?.left ?? pos.x),
			y: event.clientY - (rect?.top ?? pos.y),
		};
	}

	function moveDrag(event: PointerEvent) {
		if (!isDragging) return;
		const movedDistance = Math.hypot(
			event.clientX - dragStart.x,
			event.clientY - dragStart.y,
		);
		hasMoved = movedDistance > 4;
		pos = clampPosition(
			event.clientX - dragOffset.x,
			event.clientY - dragOffset.y,
		);
	}

	function endDrag(event: PointerEvent) {
		if (!isDragging) return;
		isDragging = false;
		petRef?.releasePointerCapture(event.pointerId);
		localStorage.setItem("sayori-blog-pet-x", String(Math.round(pos.x)));
		localStorage.setItem("sayori-blog-pet-y", String(Math.round(pos.y)));
	}

	function petClick() {
		if (hasMoved) {
			hasMoved = false;
			return;
		}
		react();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			react();
		}
	}

	onMount(() => {
		const savedMode = localStorage.getItem(storageKey);
		const shouldReset =
			localStorage.getItem(layoutVersionKey) !== layoutVersion;
		if (savedMode === "sleeping" || savedMode === "open") {
			mode = savedMode;
		}
		showTab = mode === "sleeping";

		const defaultPosition = getDefaultPosition();
		const savedX = shouldReset
			? defaultPosition.x
			: Number(localStorage.getItem("sayori-blog-pet-x"));
		const savedY = shouldReset
			? defaultPosition.y
			: Number(localStorage.getItem("sayori-blog-pet-y"));
		pos = clampPosition(
			Number.isFinite(savedX) && savedX > 0 ? savedX : defaultPosition.x,
			Number.isFinite(savedY) && savedY > 0 ? savedY : defaultPosition.y,
		);
		localStorage.setItem(layoutVersionKey, layoutVersion);
		ready = true;

		const onResize = () => {
			pos = clampPosition(pos.x, pos.y);
		};
		window.addEventListener("resize", onResize);
		return () => {
			window.removeEventListener("resize", onResize);
			if (reactTimer) clearTimeout(reactTimer);
			if (bubbleTimer) clearTimeout(bubbleTimer);
			if (sleepTimer) clearTimeout(sleepTimer);
			if (animTimer) clearTimeout(animTimer);
		};
	});
</script>

{#if ready && mode === "open"}
	<div
		bind:this={petRef}
		class="sayori-pet"
		class:dragging={isDragging}
		class:reacting={isReacting}
		class:leaving={isLeaving}
		style={`left:${pos.x}px;top:${pos.y}px;`}
		on:pointerdown={startDrag}
		on:pointermove={moveDrag}
		on:pointerup={endDrag}
		on:pointercancel={endDrag}
		on:click={petClick}
		on:keydown={handleKeydown}
		role="button"
		tabindex="0"
		aria-label="blog pet Sayori"
	>
		{#if bubbleVisible}
			<div class="pet-bubble" aria-live="polite">
				<span>{currentLine()}</span>
			</div>
		{/if}
		<div class="pet-stage">
			<button
				type="button"
				class="pet-sleep-btn"
				aria-label="让 Sayori 休息"
				on:click|stopPropagation={sleep}
			>
				<svg
					viewBox="0 0 24 24"
					width="14"
					height="14"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
				>
					<path d="M17 4a9 9 0 1 0 0 14" />
					<path d="M21 12h-4" />
				</svg>
			</button>
			{#key hopKey}
				<img
					class="pet-sprite"
					class:pet-sprite-hop={isReacting}
					class:pet-sprite-static={!isAnimating}
					src={currentSprite}
					alt=""
					draggable="false"
					on:error={handleImageError}
				/>
			{/key}
			<div class="pet-shadow"></div>
		</div>
	</div>
{:else if ready && mode === "sleeping" && showTab}
	<button
		type="button"
		class="sayori-pet-tab"
		on:click={wake}
		aria-label="叫醒 Sayori"
	>
		<span class="tab-avatar" aria-hidden="true"></span>
		<span class="tab-zzz" aria-hidden="true">z z z</span>
	</button>
{/if}

<style>
	.sayori-pet {
		position: fixed;
		z-index: 60;
		width: 160px;
		height: 180px;
		touch-action: none;
		user-select: none;
		cursor: grab;
		filter: drop-shadow(0 12px 24px rgba(90, 44, 66, 0.18));
		animation: pet-enter 240ms steps(3, end) both;
	}

	.sayori-pet.dragging {
		cursor: grabbing;
	}

	.sayori-pet.leaving {
		pointer-events: none;
		animation: pet-fade-out 600ms ease-out both;
	}

	.pet-bubble {
		position: absolute;
		left: 0;
		bottom: calc(100% - 8px);
		z-index: 5;
		width: min(180px, calc(100vw - 28px));
		padding: 0.65rem 1.8rem 0.68rem 0.8rem;
		border: 1.5px solid rgba(255, 153, 181, 0.5);
		border-radius: 14px 14px 14px 4px;
		background: rgba(255, 255, 255, 0.94);
		color: rgba(79, 48, 63, 0.88);
		font-size: 0.78rem;
		line-height: 1.5;
		box-shadow: 0 8px 20px rgba(255, 139, 171, 0.12);
		backdrop-filter: blur(10px);
		animation: bubble-pop 180ms steps(3, end) both;
	}

	.pet-bubble::after {
		position: absolute;
		left: 20px;
		bottom: -8px;
		width: 14px;
		height: 14px;
		content: "";
		background: rgba(255, 255, 255, 0.92);
		border-right: 1.5px solid rgba(255, 153, 181, 0.4);
		border-bottom: 1.5px solid rgba(255, 153, 181, 0.4);
		transform: rotate(45deg);
	}

	.pet-sleep-btn {
		position: absolute;
		right: 2px;
		top: 4px;
		z-index: 6;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: 1.5px solid rgba(255, 153, 181, 0.4);
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.88);
		color: rgba(180, 90, 130, 0.7);
		cursor: pointer;
		opacity: 0;
		transition:
			opacity 180ms ease,
			transform 120ms ease,
			background 120ms ease;
	}

	.sayori-pet:hover .pet-sleep-btn {
		opacity: 1;
	}

	.pet-sleep-btn:hover {
		background: rgba(255, 220, 235, 0.95);
		transform: scale(1.12);
		color: rgba(180, 60, 110, 0.9);
	}

	.pet-stage {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		width: 160px;
		height: 180px;
		justify-content: flex-end;
		overflow: visible;
	}

	.pet-sprite {
		position: relative;
		z-index: 1;
		width: 132px;
		height: 132px;
		object-fit: contain;
		object-position: center bottom;
		image-rendering: auto;
		pointer-events: none;
		transform-origin: center bottom;
		transition: opacity 150ms steps(2, end);
		animation: pet-float 3.2s ease-in-out infinite;
	}

	.pet-sprite-hop {
		animation: pet-hop 620ms steps(8, end) both;
	}

	.pet-sprite-static {
		width: 96px;
		height: 96px;
	}

	.pet-shadow {
		width: 80px;
		height: 14px;
		margin-top: -4px;
		border-radius: 999px;
		background: radial-gradient(
			ellipse at center,
			rgba(92, 50, 71, 0.18),
			transparent 70%
		);
	}

	.sayori-pet.reacting .pet-shadow {
		animation: pet-shadow-hop 620ms cubic-bezier(0.2, 0.9, 0.22, 1) both;
	}

	.sayori-pet-tab {
		position: fixed;
		right: 0.85rem;
		bottom: 1rem;
		z-index: 35;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.45rem 0.75rem 0.45rem 0.45rem;
		border: 1.5px solid rgba(255, 153, 181, 0.45);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.92);
		color: rgba(120, 66, 91, 0.82);
		box-shadow:
			0 8px 24px rgba(255, 139, 171, 0.16),
			inset 0 0 0 1px rgba(255, 255, 255, 0.6);
		backdrop-filter: blur(12px);
		cursor: pointer;
		transition:
			transform 160ms ease,
			box-shadow 160ms ease;
		animation: tab-slide-in 280ms ease-out both;
	}

	.sayori-pet-tab:hover {
		transform: translateY(-2px);
		box-shadow:
			0 12px 28px rgba(255, 139, 171, 0.22),
			inset 0 0 0 1px rgba(255, 255, 255, 0.7);
	}

	.tab-avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: url("/assets/pet/sayori-neutral.webp") center / 160% auto
			no-repeat;
		box-shadow: 0 2px 8px rgba(129, 63, 91, 0.12);
		flex-shrink: 0;
	}

	.tab-zzz {
		font-size: 0.7rem;
		font-style: italic;
		letter-spacing: 0.12em;
		opacity: 0.6;
		animation: zzz-float 2.4s ease-in-out infinite;
	}

	@keyframes pet-float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-5px);
		}
	}

	@keyframes pet-enter {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes pet-fade-out {
		from {
			opacity: 1;
			transform: translateY(0);
		}
		to {
			opacity: 0;
			transform: translateY(12px);
		}
	}

	@keyframes bubble-pop {
		0% {
			opacity: 0;
			transform: translateY(6px) scale(0.96);
		}
		100% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@keyframes pet-hop {
		0% {
			transform: translateY(0);
		}
		28% {
			transform: translateY(-18px);
		}
		58% {
			transform: translateY(2px);
		}
		78% {
			transform: translateY(-4px);
		}
		100% {
			transform: translateY(0);
		}
	}

	@keyframes pet-shadow-hop {
		0% {
			transform: scaleX(1);
			opacity: 0.7;
		}
		28% {
			transform: scaleX(0.7);
			opacity: 0.38;
		}
		58% {
			transform: scaleX(1.08);
			opacity: 0.76;
		}
		100% {
			transform: scaleX(1);
			opacity: 0.7;
		}
	}

	@keyframes tab-slide-in {
		from {
			opacity: 0;
			transform: translateX(20px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	@keyframes zzz-float {
		0%,
		100% {
			transform: translateY(0);
			opacity: 0.6;
		}
		50% {
			transform: translateY(-3px);
			opacity: 0.9;
		}
	}

	@media (max-width: 768px) {
		.sayori-pet {
			width: 130px;
			height: 140px;
			z-index: 45;
		}

		.pet-bubble {
			width: 150px;
			padding: 0.55rem 1.5rem 0.58rem 0.68rem;
			font-size: 0.72rem;
		}

		.pet-stage {
			width: 130px;
			height: 140px;
		}

		.pet-sleep-btn {
			opacity: 1;
			width: 24px;
			height: 24px;
		}

		.pet-sprite {
			width: 104px;
			height: 104px;
		}

		.pet-sprite-static {
			width: 76px;
			height: 76px;
		}

		.pet-shadow {
			width: 64px;
		}

		.sayori-pet-tab {
			right: auto;
			left: 0.5rem;
			bottom: 0.75rem;
			z-index: 35;
			padding: 0.38rem 0.6rem 0.38rem 0.38rem;
		}

		.tab-avatar {
			width: 28px;
			height: 28px;
		}

		.tab-zzz {
			font-size: 0.62rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sayori-pet,
		.pet-sprite,
		.pet-shadow,
		.pet-bubble,
		.sayori-pet-tab,
		.tab-zzz {
			animation: none;
		}
	}
</style>
