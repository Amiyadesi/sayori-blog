-- Stripe checkout 限流：记录每次创建结账会话的请求
CREATE TABLE IF NOT EXISTS stripe_checkout_requests (
	ip_hash TEXT NOT NULL,
	created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stripe_checkout_requests_ip_time
	ON stripe_checkout_requests (ip_hash, created_at);
