/// <reference types="mdast" />
import { h } from "hastscript";

const SITE_LANG = String(process.env.SITE_LANG || "zh_CN")
	.toLowerCase()
	.replaceAll("_", "-");
const IS_ENGLISH_BUILD = SITE_LANG.startsWith("en");
const IS_TRADITIONAL_BUILD = SITE_LANG === "zh-hant" || SITE_LANG === "zh-tw";

const RATE_PER_KG = 1.6;

const COPY = IS_ENGLISH_BUILD
	? {
			title: "Daily protein estimate",
			subtitle: "Estimated at 1.6 g per kg of body weight, converted into common foods",
			weightLabel: "Your body weight (kg)",
			placeholder: "60",
			totalSuffix: "g of protein per day",
			note: "This is a rough estimate for reference only, not an individual nutrition prescription. Actual needs depend on training, energy intake and body condition.",
			foods: [
				{ label: "Eggs (about 50 g each)", proteinPerUnit: 6.5, perAmount: 1, unit: "eggs" },
				{ label: "Chicken breast", proteinPerUnit: 23, perAmount: 100, unit: "g" },
				{ label: "Milk", proteinPerUnit: 3.3, perAmount: 100, unit: "ml" },
				{ label: "Firm tofu", proteinPerUnit: 8, perAmount: 100, unit: "g" },
			],
		}
	: IS_TRADITIONAL_BUILD
		? {
				title: "每日蛋白質估算",
				subtitle: "按每公斤體重 1.6 g 估算，換算成常見食物的份量",
				weightLabel: "你的體重（kg）",
				placeholder: "60",
				totalSuffix: "g 蛋白質 / 天",
				note: "數值僅為估算，不是個人化的營養處方。實際需求與訓練狀況、能量攝入和身體條件有關。",
				foods: [
					{ label: "雞蛋（約 50 g / 個）", proteinPerUnit: 6.5, perAmount: 1, unit: "個" },
					{ label: "雞胸肉", proteinPerUnit: 23, perAmount: 100, unit: "g" },
					{ label: "牛奶", proteinPerUnit: 3.3, perAmount: 100, unit: "ml" },
					{ label: "北豆腐", proteinPerUnit: 8, perAmount: 100, unit: "g" },
				],
			}
		: {
				title: "每日蛋白质估算",
				subtitle: "按每公斤体重 1.6 g 估算，换算成常见食物的份量",
				weightLabel: "你的体重（kg）",
				placeholder: "60",
				totalSuffix: "g 蛋白质 / 天",
				note: "数值仅为估算，不是个性化的营养处方。实际需求与训练状况、能量摄入和身体条件有关。",
				foods: [
					{ label: "鸡蛋（约 50 g / 个）", proteinPerUnit: 6.5, perAmount: 1, unit: "个" },
					{ label: "鸡胸肉", proteinPerUnit: 23, perAmount: 100, unit: "g" },
					{ label: "牛奶", proteinPerUnit: 3.3, perAmount: 100, unit: "ml" },
					{ label: "北豆腐", proteinPerUnit: 8, perAmount: 100, unit: "g" },
				],
			};

/**
 * @param {Record<string, string>} properties
 * @param {import('mdast').RootContent[]} children
 */
export function ProteinCalculatorComponent(properties, children) {
	if (Array.isArray(children) && children.length !== 0) {
		return h(
			"div",
			{ class: "hidden" },
			'Invalid directive. ("protein-calculator" must be a leaf directive)',
		);
	}

	// Food ratios are handed to the client script so the maths lives in one place.
	const foods = COPY.foods.map((food) => ({
		label: food.label,
		per: food.proteinPerUnit,
		amount: food.perAmount,
		unit: food.unit,
	}));

	return h(
		"section",
		{
			class: "protein-calc no-styling",
			"data-protein-calculator": "",
			"data-protein-rate": String(RATE_PER_KG),
			"data-protein-foods": JSON.stringify(foods),
		},
		[
			h("div", { class: "protein-calc-head" }, [
				h("div", { class: "protein-calc-title" }, COPY.title),
				h("div", { class: "protein-calc-sub" }, COPY.subtitle),
			]),
			h("label", { class: "protein-calc-field" }, [
				h("span", { class: "protein-calc-field-label" }, COPY.weightLabel),
				h("input", {
					class: "protein-calc-input",
					type: "number",
					inputmode: "decimal",
					min: "20",
					max: "250",
					step: "0.1",
					placeholder: COPY.placeholder,
					autocomplete: "off",
					"data-protein-weight": "",
				}),
			]),
			h(
				"div",
				{ class: "protein-calc-output", "data-protein-output": "", hidden: true },
				[
					h("p", { class: "protein-calc-total" }, [
						h("span", { class: "protein-calc-total-value", "data-protein-total": "" }, "—"),
						h("span", { class: "protein-calc-total-unit" }, COPY.totalSuffix),
					]),
					h("ul", { class: "protein-calc-foods", "data-protein-foods-list": "" }),
				],
			),
			h("p", { class: "protein-calc-note" }, COPY.note),
		],
	);
}
