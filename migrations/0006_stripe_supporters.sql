CREATE TABLE IF NOT EXISTS stripe_webhook_events (
	id TEXT PRIMARY KEY,
	event_type TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	processed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_created_at
	ON stripe_webhook_events (created_at DESC);

CREATE TABLE IF NOT EXISTS stripe_supporters (
	id TEXT PRIMARY KEY,
	display_name TEXT NOT NULL,
	source TEXT NOT NULL,
	session_id TEXT NOT NULL UNIQUE,
	amount_minor INTEGER NOT NULL DEFAULT 0,
	currency TEXT NOT NULL DEFAULT 'hkd',
	created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stripe_supporters_created_at
	ON stripe_supporters (created_at DESC);

INSERT OR IGNORE INTO stripe_supporters
	(id, display_name, source, session_id, amount_minor, currency, created_at)
VALUES
	('legacy:dna', 'Dna', '爱发电', 'legacy:dna', 0, 'hkd', 0),
	('legacy:04571', '爱发电用户_04571', '爱发电', 'legacy:04571', 0, 'hkd', 0),
	('legacy:eywj', '爱发电用户_eYwj', '爱发电', 'legacy:eywj', 0, 'hkd', 0),
	('legacy:1d601', '爱发电用户_1d601', '爱发电', 'legacy:1d601', 0, 'hkd', 0);
