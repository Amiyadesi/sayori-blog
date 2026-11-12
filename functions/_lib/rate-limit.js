import { getClientIp, hashValue } from "./analytics.js";

const CLEANUP_PROBABILITY = 0.02;
const CLEANUP_RETENTION_SECONDS = 86_400;

/**
 * 固定窗口限流。按 IP 哈希统计窗口内的请求数，超限则拒绝。
 *
 * 缺少 D1 绑定时放行并告警：限流是防滥用措施，不应让支付入口因基础设施缺失而整体不可用。
 */
export async function checkRateLimit(
	env,
	request,
	{ table, limit, windowSeconds, secret },
) {
	const db = env?.SAYORI_ANALYTICS_DB;
	if (!db) {
		console.warn("[rate-limit] SAYORI_ANALYTICS_DB 未绑定，跳过限流");
		return { allowed: true, retryAfterSeconds: 0 };
	}

	const ip = getClientIp(request);
	const ipHash = await hashValue(secret || "rate-limit", `ip:${ip}`);
	const now = Math.floor(Date.now() / 1000);
	const since = now - windowSeconds;

	const row = await db
		.prepare(
			`SELECT COUNT(*) AS n FROM ${table} WHERE ip_hash = ? AND created_at >= ?`,
		)
		.bind(ipHash, since)
		.first();
	const count = Number(row?.n ?? 0);

	if (count >= limit) {
		return { allowed: false, retryAfterSeconds: windowSeconds };
	}

	await db
		.prepare(`INSERT INTO ${table} (ip_hash, created_at) VALUES (?, ?)`)
		.bind(ipHash, now)
		.run();

	if (Math.random() < CLEANUP_PROBABILITY) {
		await db
			.prepare(`DELETE FROM ${table} WHERE created_at < ?`)
			.bind(now - CLEANUP_RETENTION_SECONDS)
			.run();
	}

	return { allowed: true, retryAfterSeconds: 0 };
}
