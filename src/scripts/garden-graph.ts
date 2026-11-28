interface GardenGraphNode {
	slug: string;
	title: string;
	description: string;
	url: string;
	topicId: string;
	topicTitle: string;
	topicIcon: string;
	accent: string;
	stage: string;
	degree: number;
	lastTended: string;
	updateCount: number;
	neighbors: Array<{ slug: string; title: string; url: string; outward: boolean }>;
}

interface GardenGraphPayload {
	labels: Record<string, string>;
	nodes: GardenGraphNode[];
	edges: Array<[string, string]>;
}

interface ViewNode extends GardenGraphNode {
	x: number;
	y: number;
	radius: number;
}

const DATA_ID = "garden-graph-data";
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const MIN_NODE_RADIUS = 5;

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
	const stage = document.querySelector<HTMLElement>("[data-garden-stage]");
	if (!canvas || !stage) return;
	const payload = readPayload();
	if (!payload || payload.nodes.length === 0) return;

	const context = canvas.getContext("2d");
	if (!context) return;

	const indexBySlug = new Map<string, number>();
	const nodes: ViewNode[] = payload.nodes.map((node, index) => {
		indexBySlug.set(node.slug, index);
		return {
			...node,
			x: 0,
			y: 0,
			radius: Math.max(MIN_NODE_RADIUS, Math.min(13, 5 + Math.sqrt(node.degree) * 1.9)),
		};
	});

	const edges: Array<[number, number]> = [];
	const adjacency = nodes.map(() => new Set<string>());
	for (const [fromSlug, toSlug] of payload.edges) {
		const from = indexBySlug.get(fromSlug);
		const to = indexBySlug.get(toSlug);
		if (from === undefined || to === undefined || from === to) continue;
		edges.push([from, to]);
		adjacency[from].add(toSlug);
		adjacency[to].add(fromSlug);
	}

	const topicOrder: string[] = [];
	const byTopic = new Map<string, ViewNode[]>();
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
	let hovered: ViewNode | null = null;
	let selected: ViewNode | null = null;
	let panning: { startX: number; startY: number; originX: number; originY: number } | null = null;
	let dragging: ViewNode | null = null;
	let activeStage = "all";
	let activeTopic = "all";

	const filterPanel = document.querySelector<HTMLElement>("[data-garden-filters]");
	const detailPanel = document.querySelector<HTMLElement>("[data-garden-detail]");
	const detailBody = document.querySelector<HTMLElement>("[data-garden-detail-body]");
	const barPanel = document.querySelector<HTMLElement>("[data-garden-bar]");

	// Keep the graph out from under the floating panels so nothing hides behind them.
	const safeRect = () => {
		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		const wide = window.matchMedia("(min-width: 1024px)").matches;
		const filterWidth = wide ? (filterPanel?.offsetWidth ?? 260) + 24 : 0;
		const detailWidth =
			wide && selected && detailPanel ? detailPanel.offsetWidth + 24 : 0;
		const topInset = wide ? 24 : (filterPanel?.offsetHeight ?? 140) + 16;
		const bottomInset = wide ? 72 : (barPanel?.offsetHeight ?? 76) + 16;
		const sideInset = wide ? 0 : 18;
		return {
			x: filterWidth + sideInset,
			y: topInset,
			width: Math.max(120, width - filterWidth - detailWidth - sideInset * 2),
			height: Math.max(120, height - topInset - bottomInset),
		};
	};

	const layout = () => {
		const rect = safeRect();
		const centerX = rect.x + rect.width / 2;
		const centerY = rect.y + rect.height / 2;
		const radiusX = rect.width * 0.36;
		const radiusY = rect.height * 0.36;
		const spreadLimit = Math.max(28, Math.min(92, Math.min(rect.width, rect.height) * 0.13));

		topicOrder.forEach((topicId, topicIndex) => {
			const members = byTopic.get(topicId)!;
			const angle = (topicIndex / topicOrder.length) * Math.PI * 2 - Math.PI / 2;
			const clusterX = centerX + Math.cos(angle) * radiusX;
			const clusterY = centerY + Math.sin(angle) * radiusY;
			const spread = Math.min(spreadLimit, 22 + members.length * 6.5);
			members.forEach((node, memberIndex) => {
				const radius = spread * Math.sqrt((memberIndex + 0.5) / members.length);
				const theta = memberIndex * GOLDEN_ANGLE;
				node.x = clusterX + Math.cos(theta) * radius;
				node.y = clusterY + Math.sin(theta) * radius;
			});
		});
	};

	const dimmed = (node: ViewNode) => {
		if (activeStage !== "all" && node.stage !== activeStage) return true;
		if (activeTopic !== "all" && node.topicId !== activeTopic) return true;
		return false;
	};

	const draw = () => {
		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		context.clearRect(0, 0, width, height);
		context.save();
		context.translate(offsetX, offsetY);
		context.scale(scale, scale);

		const focus = hovered ?? selected;
		const neighbourSlugs = new Set<string>();
		if (focus) {
			for (const [from, to] of edges) {
				if (nodes[from] === focus) neighbourSlugs.add(nodes[to].slug);
				if (nodes[to] === focus) neighbourSlugs.add(nodes[from].slug);
			}
		}
		const dark = document.documentElement.classList.contains("dark");
		const edgeBase = dark ? "196, 199, 185" : "122, 126, 112";

		for (const [from, to] of edges) {
			const a = nodes[from];
			const b = nodes[to];
			const isFocus = focus !== null && (a === focus || b === focus);
			const alpha = focus
				? isFocus
					? 0.5
					: 0.045
				: dimmed(a) || dimmed(b)
					? 0.035
					: 0.1;
			context.strokeStyle = `rgba(${edgeBase}, ${alpha})`;
			context.lineWidth = isFocus ? 1.6 : 0.9;
			context.beginPath();
			context.moveTo(a.x, a.y);
			context.lineTo(b.x, b.y);
			context.stroke();
		}

		for (const node of nodes) {
			const isDim = dimmed(node);
			const isFocus = focus === node;
			const isNeighbour = neighbourSlugs.has(node.slug);
			context.globalAlpha = isDim ? 0.16 : focus && !isFocus && !isNeighbour ? 0.35 : 1;

			context.beginPath();
			context.arc(node.x, node.y, node.radius + (isFocus ? 4 : 0), 0, Math.PI * 2);
			context.fillStyle = node.accent;
			context.fill();
			context.lineWidth = isFocus ? 2.6 : 1.4;
			context.strokeStyle = dark ? "#282b24" : "#fffdf8";
			context.stroke();

			if (selected === node) {
				context.beginPath();
				context.arc(node.x, node.y, node.radius + 8, 0, Math.PI * 2);
				context.lineWidth = 1.2;
				context.strokeStyle = node.accent;
				context.globalAlpha = 0.55;
				context.stroke();
				context.globalAlpha = 1;
			}
		}

		if (hovered) {
			context.globalAlpha = 1;
			context.font = "600 12px system-ui, -apple-system, sans-serif";
			context.textAlign = "center";
			context.textBaseline = "bottom";
			const label = hovered.title.length > 24 ? `${hovered.title.slice(0, 24)}…` : hovered.title;
			const labelWidth = context.measureText(label).width;
			const boxY = hovered.y - hovered.radius - 30;
			const boxX = hovered.x - labelWidth / 2 - 8;
			context.fillStyle = dark ? "rgba(233, 232, 222, 0.94)" : "rgba(48, 51, 45, 0.92)";
			context.beginPath();
			context.roundRect(boxX, boxY, labelWidth + 16, 22, 6);
			context.fill();
			context.fillStyle = dark ? "#22241f" : "#fffdf8";
			context.fillText(label, hovered.x, boxY + 16);
		}

		context.globalAlpha = 1;
		context.restore();
	};

	const relayout = () => {
		const anchor = selected;
		const before = anchor
			? { x: anchor.x * scale + offsetX, y: anchor.y * scale + offsetY }
			: null;
		layout();
		if (anchor && before) {
			offsetX = before.x - anchor.x * scale;
			offsetY = before.y - anchor.y * scale;

			// Narrow screens stack panels over the map; nudge the open note into the
			// band that is still visible between the filter strip and the sheet.
			if (!window.matchMedia("(min-width: 1024px)").matches) {
				const bandTop = (filterPanel?.offsetHeight ?? 0) + 16;
				const sheet = detailPanel && !detailPanel.hidden ? detailPanel.offsetHeight + 12 : 0;
				const bandBottom =
					canvas.clientHeight - sheet - (barPanel?.offsetHeight ?? 0) - 16;
				const screenY = anchor.y * scale + offsetY;
				if (screenY > bandBottom) offsetY -= screenY - bandBottom;
				const nudged = anchor.y * scale + offsetY;
				if (nudged < bandTop) offsetY += bandTop - nudged;
			}
		}
		draw();
	};

	const resize = () => {
		const ratio = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		const width = Math.max(1, Math.round(rect.width * ratio));
		const height = Math.max(1, Math.round(rect.height * ratio));
		if (canvas.width !== width || canvas.height !== height) {
			canvas.width = width;
			canvas.height = height;
		}
		context.setTransform(ratio, 0, 0, ratio, 0, 0);
		relayout();
	};

	const toWorld = (clientX: number, clientY: number) => {
		const rect = canvas.getBoundingClientRect();
		return {
			x: (clientX - rect.left - offsetX) / scale,
			y: (clientY - rect.top - offsetY) / scale,
		};
	};

	const pick = (clientX: number, clientY: number): ViewNode | null => {
		const point = toWorld(clientX, clientY);
		let best: ViewNode | null = null;
		let bestDistance = Number.POSITIVE_INFINITY;
		for (const node of nodes) {
			if (dimmed(node)) continue;
			const distance = Math.hypot(node.x - point.x, node.y - point.y);
			if (distance <= node.radius + 8 && distance < bestDistance) {
				best = node;
				bestDistance = distance;
			}
		}
		return best;
	};

	const labels = payload.labels;
	const escapeHtml = (value: string) =>
		value
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");

	const renderDetail = () => {
		if (!detailPanel || !detailBody) return;
		if (!selected) {
			detailPanel.hidden = true;
			return;
		}
		const node = selected;
		const stageIcon =
			node.stage === "evergreen" ? "🌲" : node.stage === "budding" ? "🌿" : "🌱";
		const stageName = labels[`stage.${node.stage}`] || node.stage;
		const siblingCount = byTopic.get(node.topicId)?.length ?? 0;

		detailBody.innerHTML = `
			<p class="garden-detail__meta">
				<span class="garden-detail__topic"><span aria-hidden="true">${escapeHtml(node.topicIcon)}</span>${escapeHtml(node.topicTitle)}</span>
				<span aria-hidden="true">·</span>
				<span><span aria-hidden="true">${stageIcon}</span> ${escapeHtml(stageName)}</span>
			</p>
			<h2 class="garden-detail__title">${escapeHtml(node.title)}</h2>
			${node.description ? `<p class="garden-detail__desc">${escapeHtml(node.description)}</p>` : ""}
			<p class="garden-detail__facts">
				<span>${escapeHtml(labels.tended)} ${escapeHtml(node.lastTended)}</span>
				${node.updateCount > 0 ? `<span>${escapeHtml(labels.revisions.replace("{count}", String(node.updateCount)))}</span>` : ""}
				<span>${escapeHtml(labels.linksCount.replace("{count}", String(node.degree)))}</span>
			</p>
			<a class="garden-detail__open" href="${escapeHtml(node.url)}">${escapeHtml(labels.open)}<span aria-hidden="true"> →</span></a>
			${
				node.neighbors.length
					? `<div class="garden-detail__links">
						<h3>${escapeHtml(labels.related)}</h3>
						<ul>${node.neighbors
							.slice(0, 12)
							.map(
								(item) =>
									`<li><button type="button" data-jump="${escapeHtml(item.slug)}"><span aria-hidden="true">${item.outward ? "↗" : "↘"}</span>${escapeHtml(item.title)}</button></li>`,
							)
							.join("")}</ul>
					</div>`
					: ""
			}
			<p class="garden-detail__siblings">${escapeHtml(labels.siblings.replace("{count}", String(siblingCount)))}</p>
		`;
		detailPanel.hidden = false;
	};

	const select = (node: ViewNode | null) => {
		selected = node;
		renderDetail();
		relayout();
	};

	canvas.addEventListener("mousemove", (event) => {
		if (panning) {
			offsetX = panning.originX + (event.clientX - panning.startX);
			offsetY = panning.originY + (event.clientY - panning.startY);
			draw();
			return;
		}
		if (dragging) {
			const point = toWorld(event.clientX, event.clientY);
			dragging.x = point.x;
			dragging.y = point.y;
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
		if (node) {
			dragging = node;
			canvas.style.cursor = "grabbing";
			return;
		}
		panning = { startX: event.clientX, startY: event.clientY, originX: offsetX, originY: offsetY };
		canvas.style.cursor = "grabbing";
	});

	window.addEventListener("mouseup", () => {
		dragging = null;
		panning = null;
		canvas.style.cursor = hovered ? "pointer" : "grab";
	});

	canvas.addEventListener("click", (event) => {
		if (panning) return;
		const node = pick(event.clientX, event.clientY);
		select(node);
	});

	canvas.addEventListener("dblclick", (event) => {
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
			const world = toWorld(event.clientX, event.clientY);
			scale = Math.min(3, Math.max(0.45, scale * (event.deltaY > 0 ? 0.9 : 1.1)));
			offsetX = pointerX - world.x * scale;
			offsetY = pointerY - world.y * scale;
			draw();
		},
		{ passive: false },
	);

	document.querySelector("[data-garden-graph-reset]")?.addEventListener("click", () => {
		scale = 1;
		offsetX = 0;
		offsetY = 0;
		activeStage = "all";
		activeTopic = "all";
		document.querySelectorAll<HTMLButtonElement>("[data-garden-stage], [data-garden-topic]").forEach((chip) => {
			chip.setAttribute("aria-pressed", String(chip.dataset.gardenStage === "all" || chip.dataset.gardenTopic === "all"));
		});
		select(null);
		layout();
		draw();
	});

	document.querySelector("[data-garden-detail-close]")?.addEventListener("click", () => {
		select(null);
	});

	detailBody?.addEventListener("click", (event) => {
		const target = event.target;
		if (!(target instanceof Element)) return;
		const jump = target.closest<HTMLElement>("[data-jump]");
		if (!jump) return;
		const index = indexBySlug.get(jump.dataset.jump || "");
		if (index === undefined) return;
		select(nodes[index]);
	});

	document.querySelectorAll<HTMLButtonElement>("[data-garden-stage]").forEach((chip) => {
		chip.addEventListener("click", () => {
			activeStage = chip.dataset.gardenStage || "all";
			document.querySelectorAll<HTMLButtonElement>("[data-garden-stage]").forEach((item) => {
				item.setAttribute("aria-pressed", String(item === chip));
			});
			if (selected && dimmed(selected)) select(null);
			draw();
		});
	});

	document.querySelectorAll<HTMLButtonElement>("[data-garden-topic]").forEach((chip) => {
		chip.addEventListener("click", () => {
			const next = chip.dataset.gardenTopic || "all";
			activeTopic = activeTopic === next ? "all" : next;
			document.querySelectorAll<HTMLButtonElement>("[data-garden-topic]").forEach((item) => {
				item.setAttribute("aria-pressed", String(item.dataset.gardenTopic === activeTopic));
			});
			if (selected && dimmed(selected)) select(null);
			draw();
		});
	});

	document.addEventListener("keydown", (event) => {
		if (event.key !== "Escape" || !selected) return;
		select(null);
	});

	new ResizeObserver(() => resize()).observe(canvas);
	window.addEventListener("resize", resize);
	resize();

	// Deep link: /garden/#topic-server-selfhost preselects a greenhouse.
	const hash = window.location.hash;
	if (hash.startsWith("#topic-")) {
		const wanted = hash.slice("#topic-".length);
		const chip = document.querySelector<HTMLButtonElement>(`[data-garden-topic="${CSS.escape(wanted)}"]`);
		chip?.click();
	}
}

setupGraph();
document.addEventListener("astro:page-load", setupGraph);

export {};
