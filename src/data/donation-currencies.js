export const DONATION_CURRENCIES = [
	{
		code: "usd",
		labelEn: "US Dollar (USD)",
		labelZh: "美元（USD）",
		symbol: "$",
		decimals: 2,
		minimum: 2,
		maximum: 10_000,
		presets: [2, 5, 10],
	},
	{
		code: "cny",
		labelEn: "Chinese Yuan (CNY)",
		labelZh: "人民币（CNY）",
		symbol: "¥",
		decimals: 2,
		minimum: 10,
		maximum: 10_000,
		presets: [10, 20, 50],
	},
	{
		code: "hkd",
		labelEn: "Hong Kong Dollar (HKD)",
		labelZh: "港币（HKD）",
		symbol: "HK$",
		decimals: 2,
		minimum: 15,
		maximum: 10_000,
		presets: [15, 30, 100],
	},
	{
		code: "eur",
		labelEn: "Euro (EUR)",
		labelZh: "欧元（EUR）",
		symbol: "€",
		decimals: 2,
		minimum: 2,
		maximum: 10_000,
		presets: [2, 5, 10],
	},
	{
		code: "gbp",
		labelEn: "Pound Sterling (GBP)",
		labelZh: "英镑（GBP）",
		symbol: "£",
		decimals: 2,
		minimum: 2,
		maximum: 10_000,
		presets: [2, 5, 10],
	},
	{
		code: "jpy",
		labelEn: "Japanese Yen (JPY)",
		labelZh: "日元（JPY）",
		symbol: "¥",
		decimals: 0,
		minimum: 300,
		maximum: 1_000_000,
		presets: [300, 500, 1_000],
	},
	{
		code: "sgd",
		labelEn: "Singapore Dollar (SGD)",
		labelZh: "新加坡元（SGD）",
		symbol: "S$",
		decimals: 2,
		minimum: 3,
		maximum: 10_000,
		presets: [3, 8, 15],
	},
	{
		code: "aud",
		labelEn: "Australian Dollar (AUD)",
		labelZh: "澳元（AUD）",
		symbol: "A$",
		decimals: 2,
		minimum: 3,
		maximum: 10_000,
		presets: [3, 8, 15],
	},
	{
		code: "cad",
		labelEn: "Canadian Dollar (CAD)",
		labelZh: "加元（CAD）",
		symbol: "C$",
		decimals: 2,
		minimum: 3,
		maximum: 10_000,
		presets: [3, 8, 15],
	},
];

export const DEFAULT_DONATION_CURRENCY = "hkd";

export function getDonationCurrency(value) {
	const code = String(value ?? "")
		.trim()
		.toLowerCase();
	return (
		DONATION_CURRENCIES.find((currency) => currency.code === code) || null
	);
}
