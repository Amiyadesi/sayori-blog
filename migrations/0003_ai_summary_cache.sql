CREATE TABLE IF NOT EXISTS ai_summary_cache (
	path TEXT PRIMARY KEY,
	source_hash TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('ready', 'pending', 'error')),
	items_json TEXT NOT NULL DEFAULT '[]',
	model TEXT NOT NULL DEFAULT '',
	error_message TEXT NOT NULL DEFAULT '',
	generated_at INTEGER,
	cooldown_until INTEGER NOT NULL DEFAULT 0,
	updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_summary_cache_status_cooldown
	ON ai_summary_cache (status, cooldown_until);
