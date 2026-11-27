interface GardenGraphNode {
	slug: string;
	title: string;
	url: string;
	topicId: string;
	stage: string;
	degree: number;
	topicTitle: string;
	topicIcon: string;
	accent: string;
	lastTended: string;
}

interface GardenGraphPayload {
	nodes: GardenGraphNode[];
	edges: Array<[string, string]>;
}

interface SimNode extends GardenGraphNode {
	x: number;
	y: number;
	radius: number;
	pinned: boolean;
}

const DATA_ID = "garden-graph-data";
const BASE_PADDING = 44;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function readPayload(): GardenGraphPayload | null {
	const element = document.getElementById(DATA_ID);
	if (!element?.textContent) return null;
	try {
		return JSON.parse(element.textContent) as GardenGraphPayload;
	} catch {
		return null;
	}
}

function setupGraph(): void {
	const canvas = document.querySelector<HTMLCanvasElement>("[data-garden-graph]");
	if (!canvas) return;
	const payload = readPayload();
	if (!payload || payload.nodes.length === 0) return;

	const context = canvas.getContext("2d");
	if (!context) return;

	const indexBySlug = new Map<string, number>();
	const nodes: SimNode[] = payload.nodes.map((node, index) => {
		indexBySlug.set(node.slug, index);
		return {
			...node,
			x: 0,
			y: 0,
			radius: Math.min(12, 4.5 + Math.sqrt(node.degree) * 1.9),
			pinned: false,
		};
	});

	const edges: Array<[number, number]> = [];
	for (const [fromSlug, toSlug] of payload.edges) {
		const from = indexBySlug.get(fromSlug);
		const to = indexBySlug.get(toSlug);
		if (from === undefined || to === undefined || from === to) continue;
		edges.push([from, to]);
	}

	// Group by topic so each greenhouse becomes one visual cluster.
	const topicOrder: string[] = [];
	const byTopic = new Map<string, SimNode[]>();
	for (const node of nodes) {
		if (!byTopic.has(node.topicId)) {
			byTopic.set(node.topicId, []);
			topicOrder.push(node.topicId);
		}
		byTopic.get(node.topicId)!.push(node);
	}

	let scale = 1;
	let offsetX = 0;
	let offsetY = 0;
	let hovered: SimNode | null = null;
	let dragged: SimNode | null = null;
	let activeStage = "all";
	let allowed: Set<string> | null = null;
	let userAdjustedView = false;
	let laidOut = false;

	// Deterministic layout: topic clusters on a ring, members spiralled inside.
	const layout = () => {
		const width = canvas.clientWidth || 900;
		const height = canvas.clientHeight || 480;
		const ringRadius = Math.min(width, height) * 0.34;
		const centerX = width / 2;
		const centerY = height / 2;

		topicOrder.forEach((topicId, topicIndex) => {
			const members = byTopic.get(topicId)!;
			const angle = (topicIndex / topicOrder.length) * Math.PI * 2 - Math.PI / 2;
			const clusterX = centerX + Math.cos(angle) * ringRadius;
			const clusterY = centerY + Math.sin(angle) * ringRadius;
			const spread = Math.min(78, 24 + members.length * 7.5);
			members.forEach((node, memberIndex) => {
				if (node.pinned) return;
				const radius = spread * Math.sqrt((memberIndex + 0.5) / members.length);
				const theta = memberIndex * GOLDEN_ANGLE;
				node.x = clusterX + Math.cos(theta) * radius;
				node.y = clusterY + Math.sin(theta) * radius * 0.82;
			});
		});
	};

	const fitView = () => {
		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		if (nodes.length === 0 || width === 0 || height === 0) return;
		let minX = Number.POSITIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;
		for (const node of nodes) {
			minX = Math.min(minX, node.x - node.radius);
			minY = Math.min(minY, node.y - node.radius);
			maxX = Math.max(maxX, node.x + node.radius);
			maxY = Math.max(maxY, node.y + node.radius);
		}
		const spanX = Math.max(1, maxX - minX);
		const spanY = Math.max(1, maxY - minY);
		const usableWidth = Math.max(1, width - BASE_PADDING * 2);
		const usableHeight = Math.max(1, height - BASE_PADDING * 2);
		scale = Math.min(usableWidth / spanX, usableHeight / spanY, 1.5);
		offsetX = (width - spanX * scale) / 2 - minX * scale;
		offsetY = (height - spanY * scale) / 2 - minY * scale;
	};

	const resize = () => {
		const ratio = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		canvas.width = Math.max(1, Math.round(rect.width * ratio));
		canvas.height = Math.max(1, Math.round(rect.height * ratio));
		context.setTransform(ratio, 0, 0, ratio, 0, 0);
		if (!laidOut) {
			layout();
			laidOut = true;
			userAdjustedView = false;
		}
		if (!userAdjustedView) fitView();
		draw();
	};

	const draw = () => {
		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		context.clearRect(0, 0, width, height);
		context.save();
		context.translate(offsetX, offsetY);
		context.scale(scale, scale);

		const dimmed = (node: SimNode) => allowed !== null && !allowed.has(node.slug);
		const neighborSlugs = new Set<string>();
		if (hovered) {
			for (const [from, to] of edges) {
				if (nodes[from] === hovered) neighborSlugs.add(nodes[to].slug);
				if (nodes[to] === hovered) neighborSlugs.add(nodes[from].slug);
			}
		}

		for (const [from, to] of edges) {
			const a = nodes[from];
			const b = nodes[to];
			const isFocus = hovered !== null && (a === hovered || b === hovered);
			const alpha = hovered
				? isFocus
					? 0.55
					: 0.05
				: dimmed(a) || dimmed(b)
					? 0.04
					: 0.12;
			context.strokeStyle = `rgba(122, 126, 112, ${alpha})`;
			context.lineWidth = isFocus ? 1.5 : 0.9;
			context.beginPath();
			context.moveTo(a.x, a.y);
			context.lineTo(b.x, b.y);
			context.stroke();
		}

		for (const node of nodes) {
			const isDim = dimmed(node);
			const isHover = hovered === node;
			const isNeighbor = neighborSlugs.has(node.slug);
			context.globalAlpha = isDim ? 0.2 : hovered && !isHover && !isNeighbor ? 0.4 : 1;

			context.beginPath();
			context.arc(node.x, node.y, node.radius + (isHover ? 3 : 0), 0, Math.PI * 2);
			context.fillStyle = node.accent;
			context.fill();
			context.lineWidth = isHover ? 2.4 : 1.3;
			context.strokeStyle = "#fffdf8";
			context.stroke();

			if (isHover) {
				context.globalAlpha = 1;
				context.font = "600 12px system-ui, -apple-system, sans-serif";
				context.textAlign = "center";
				context.textBaseline = "bottom";
				const label = node.title.length > 22 ? `${node.title.slice(0, 22)}…` : node.title;
				const labelWidth = context.measureText(label).width;
				const boxY = node.y - node.radius - 26;
				const boxX = node.x - labelWidth / 2 - 7;
				context.fillStyle = "rgba(48, 51, 45, 0.92)";
				context.beginPath();
				context.roundRect(boxX, boxY, labelWidth + 14, 20, 5);
				context.fill();
				context.fillStyle = "#fffdf8";
				context.fillText(label, node.x, boxY + 15);
			}
		}

		context.globalAlpha = 1;
		context.restore();
	};

	const toWorld = (clientX: number, clientY: number) => {
		const rect = canvas.getBoundingClientRect();
		return {
			x: (clientX - rect.left - offsetX) / scale,
			y: (clientY - rect.top - offsetY) / scale,
		};
	};

	const pick = (clientX: number, clientY: number): SimNode | null => {
		const point = toWorld(clientX, clientY);
		let best: SimNode | null = null;
		let bestDistance = Number.POSITIVE_INFINITY;
		for (const node of nodes) {
			if (allowed !== null && !allowed.has(node.slug)) continue;
			const distance = Math.hypot(node.x - point.x, node.y - point.y);
			if (distance <= node.radius + 6 && distance < bestDistance) {
				best = node;
				bestDistance = distance;
			}
		}
		return best;
	};

	canvas.addEventListener("mousemove", (event) => {
		if (dragged) {
			const point = toWorld(event.clientX, event.clientY);
			dragged.x = point.x;
			dragged.y = point.y;
			draw();
			return;
		}
		const node = pick(event.clientX, event.clientY);
		if (node !== hovered) {
			hovered = node;
			canvas.style.cursor = node ? "pointer" : "grab";
			draw();
		}
	});

	canvas.addEventListener("mousedown", (event) => {
		const node = pick(event.clientX, event.clientY);
		if (!node) return;
		dragged = node;
		node.pinned = true;
		canvas.style.cursor = "grabbing";
	});

	window.addEventListener("mouseup", () => {
		if (!dragged) return;
		dragged.pinned = false;
		dragged = null;
		canvas.style.cursor = hovered ? "pointer" : "grab";
	});

	canvas.addEventListener("click", (event) => {
		const node = pick(event.clientX, event.clientY);
		if (node) window.location.href = node.url;
	});

	canvas.addEventListener("mouseleave", () => {
		if (hovered) {
			hovered = null;
			draw();
		}
	});

	canvas.addEventListener(
		"wheel",
		(event) => {
			event.preventDefault();
			const rect = canvas.getBoundingClientRect();
			const pointerX = event.clientX - rect.left;
			const pointerY = event.clientY - rect.top;
			const worldBefore = toWorld(event.clientX, event.clientY);
			userAdjustedView = true;
			scale = Math.min(2.6, Math.max(0.4, scale * (event.deltaY > 0 ? 0.9 : 1.1)));
			offsetX = pointerX - worldBefore.x * scale;
			offsetY = pointerY - worldBefore.y * scale;
			draw();
		},
		{ passive: false },
	);

	const resetButton = document.querySelector<HTMLButtonElement>("[data-garden-graph-reset]");
	resetButton?.addEventListener("click", () => {
		for (const node of nodes) node.pinned = false;
		laidOut = false;
		userAdjustedView = false;
		layout();
		laidOut = true;
		fitView();
		draw();
	});

	window.addEventListener("resize", resize);

	const stageButtons = document.querySelectorAll<HTMLButtonElement>("[data-garden-stage]");
	stageButtons.forEach((button) => {
		button.addEventListener("click", () => {
			activeStage = button.dataset.gardenStage || "all";
			allowed =
				activeStage === "all"
					? null
					: new Set(
							nodes.filter((node) => node.stage === activeStage).map((node) => node.slug),
						);
			stageButtons.forEach((item) => {
				item.setAttribute("aria-pressed", String(item === button));
			});
			draw();
		});
	});

	resize();
	requestAnimationFrame(() => {
		if (!userAdjustedView) fitView();
		draw();
	});
}

setupGraph();
document.addEventListener("astro:page-load", setupGraph);

export {};
