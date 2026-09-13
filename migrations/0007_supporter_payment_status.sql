ALTER TABLE stripe_supporters
	ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE stripe_supporters
	ADD COLUMN payment_intent_id TEXT;

ALTER TABLE stripe_supporters
	ADD COLUMN charge_id TEXT;

ALTER TABLE stripe_supporters
	ADD COLUMN status_updated_at INTEGER;

CREATE INDEX IF NOT EXISTS idx_stripe_supporters_payment_intent
	ON stripe_supporters (payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_stripe_supporters_charge
	ON stripe_supporters (charge_id);
