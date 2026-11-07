const SELECTOR = "[data-protein-calculator]";
const BOUND = "proteinCalculatorBound";

type FoodRatio = {
	label: string;
	per: number;
	amount?: number;
	unit: string;
};

function formatAmount(value: number): string {
	if (!Number.isFinite(value) || value <= 0) return "—";
	if (value >= 100) return String(Math.round(value));
	if (value >= 10) return (Math.round(value * 10) / 10).toFixed(1);
	return (Math.round(value * 10) / 10).toFixed(1);
}

function render(root: HTMLElement) {
	const input = root.querySelector<HTMLInputElement>("[data-protein-weight]");
	const output = root.querySelector<HTMLElement>("[data-protein-output]");
	const totalEl = root.querySelector<HTMLElement>("[data-protein-total]");
	const listEl = root.querySelector<HTMLElement>("[data-protein-foods-list]");
	if (!input || !output || !totalEl || !listEl) return;

	const rate = Number(root.dataset.proteinRate || "1.6");
	const foods: FoodRatio[] = JSON.parse(root.dataset.proteinFoods || "[]");
	const weight = Number(input.value);

	if (!Number.isFinite(weight) || weight < 20 || weight > 250) {
		output.hidden = true;
		totalEl.textContent = "—";
		listEl.textContent = "";
		return;
	}

	const total = weight * rate;
	totalEl.textContent = String(Math.round(total));

	listEl.textContent = "";
	for (const food of foods) {
		if (!food.per) continue;
		// per = protein grams in one basis amount (1 egg, or 100 g / 100 ml)
		const basis = food.amount && food.amount > 0 ? food.amount : 1;
		const amount = (total / food.per) * basis;
		const li = document.createElement("li");
		li.className = "protein-calc-food";
		const label = document.createElement("span");
		label.className = "protein-calc-food-label";
		label.textContent = food.label;
		const value = document.createElement("span");
		value.className = "protein-calc-food-value";
		value.textContent = `≈ ${formatAmount(amount)} ${food.unit}`;
		li.append(label, value);
		listEl.append(li);
	}

	output.hidden = false;
}

function bind() {
	for (const root of document.querySelectorAll<HTMLElement>(SELECTOR)) {
		if (root.dataset[BOUND] === "true") continue;
		root.dataset[BOUND] = "true";
		const input = root.querySelector<HTMLInputElement>("[data-protein-weight]");
		if (!input) continue;
		input.addEventListener("input", () => render(root));
		input.addEventListener("change", () => render(root));
		if (input.value) render(root);
	}
}

if (typeof document !== "undefined") {
	document.addEventListener("input", (event) => {
		const target = event.target as HTMLElement | null;
		if (target?.matches?.("[data-protein-weight]")) {
			const root = target.closest<HTMLElement>(SELECTOR);
			if (root) render(root);
		}
	});
	document.addEventListener("astro:page-load", bind);
	document.addEventListener("swup:contentReplaced", bind);
	bind();
}
