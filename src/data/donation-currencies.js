// minimum 必须 >= Stripe 对该结算货币的最低收款额，否则结账会被 Stripe 以
// amount_too_small 拒绝（结算货币为 HKD 时下限 HK$4.00，USD 为 $0.50）。
// 非结算货币按等值换算，取整后仍需高于 HKD 4.00 的等值，因此 HKD/CNY 用 4。
export const DONATION_CURRENCIES = [
	{
		code: "usd",
		labelEn: "US Dollar (USD)",
		labelZh: "美元（USD）",
		symbol: "$",
		decimals: 2,
		minimum: 1,
		maximum: 10_000,
		presets: [1, 3, 5],
	},
	{
		code: "cny",
		labelEn: "Chinese Yuan (CNY)",
		labelZh: "人民币（CNY）",
		symbol: "¥",
		decimals: 2,
		minimum: 4,
		maximum: 10_000,
		presets: [4, 10, 20],
	},
	{
		code: "hkd",
		labelEn: "Hong Kong Dollar (HKD)",
		labelZh: "港币（HKD）",
		symbol: "HK$",
		decimals: 2,
		minimum: 4,
		maximum: 10_000,
		presets: [4, 10, 20],
	},
	{
		code: "eur",
		labelEn: "Euro (EUR)",
		labelZh: "欧元（EUR）",
		symbol: "€",
		decimals: 2,
		minimum: 1,
		maximum: 10_000,
		presets: [1, 3, 5],
	},
	{
		code: "gbp",
		labelEn: "Pound Sterling (GBP)",
		labelZh: "英镑（GBP）",
		symbol: "£",
		decimals: 2,
		minimum: 1,
		maximum: 10_000,
		presets: [1, 3, 5],
	},
	{
		code: "jpy",
		labelEn: "Japanese Yen (JPY)",
		labelZh: "日元（JPY）",
		symbol: "¥",
		decimals: 0,
		minimum: 100,
		maximum: 1_000_000,
		presets: [100, 300, 500],
	},
	{
		code: "sgd",
		labelEn: "Singapore Dollar (SGD)",
		labelZh: "新加坡元（SGD）",
		symbol: "S$",
		decimals: 2,
		minimum: 1,
		maximum: 10_000,
		presets: [1, 3, 5],
	},
	{
		code: "aud",
		labelEn: "Australian Dollar (AUD)",
		labelZh: "澳元（AUD）",
		symbol: "A$",
		decimals: 2,
		minimum: 1,
		maximum: 10_000,
		presets: [1, 3, 5],
	},
	{
		code: "cad",
		labelEn: "Canadian Dollar (CAD)",
		labelZh: "加元（CAD）",
		symbol: "C$",
		decimals: 2,
		minimum: 1,
		maximum: 10_000,
		presets: [1, 3, 5],
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
