CREATE TABLE IF NOT EXISTS growth_topics (
	id TEXT PRIMARY KEY,
	slug TEXT NOT NULL UNIQUE,
	title TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('candidate', 'draft', 'published', 'archived')),
	priority INTEGER NOT NULL DEFAULT 0,
	audience_json TEXT NOT NULL DEFAULT '[]',
	article_paths_json TEXT NOT NULL DEFAULT '[]',
	evidence_json TEXT NOT NULL DEFAULT '[]',
	draft_json TEXT NOT NULL DEFAULT '{}',
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_topics_status_priority
	ON growth_topics (status, priority DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS growth_channels (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	source TEXT NOT NULL,
	medium TEXT NOT NULL CHECK (medium IN ('community', 'video', 'social', 'repository', 'referral', 'feed', 'email', 'offline')),
	entry_url TEXT NOT NULL DEFAULT '',
	audience TEXT NOT NULL DEFAULT '',
	rules TEXT NOT NULL DEFAULT '',
	suitable_content TEXT NOT NULL DEFAULT '',
	last_published_at INTEGER,
	metrics_json TEXT NOT NULL DEFAULT '{}',
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_channels_source
	ON growth_channels (source, updated_at DESC);

CREATE TABLE IF NOT EXISTS growth_tasks (
	id TEXT PRIMARY KEY,
	topic_slug TEXT NOT NULL DEFAULT '',
	post_path TEXT NOT NULL DEFAULT '',
	kind TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('open', 'doing', 'done', 'archived')),
	priority TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'normal', 'low')),
	title TEXT NOT NULL,
	reason TEXT NOT NULL DEFAULT '',
	detail_json TEXT NOT NULL DEFAULT '{}',
	due_at INTEGER,
	completed_at INTEGER,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_tasks_status_priority
	ON growth_tasks (status, priority, updated_at DESC);

CREATE TABLE IF NOT EXISTS growth_campaigns (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	topic_slug TEXT NOT NULL DEFAULT '',
	post_path TEXT NOT NULL DEFAULT '',
	status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'reviewed', 'archived')),
	source TEXT NOT NULL,
	medium TEXT NOT NULL,
	content TEXT NOT NULL DEFAULT '',
	target_url TEXT NOT NULL,
	landing_visits INTEGER NOT NULL DEFAULT 0,
	effective_reads INTEGER NOT NULL DEFAULT 0,
	published_at INTEGER,
	review_due_at INTEGER,
	metrics_json TEXT NOT NULL DEFAULT '{}',
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_campaigns_review
	ON growth_campaigns (status, review_due_at, updated_at DESC);

CREATE TABLE IF NOT EXISTS growth_snapshots (
	id TEXT PRIMARY KEY,
	scope_type TEXT NOT NULL,
	scope_key TEXT NOT NULL,
	source TEXT NOT NULL CHECK (source IN ('search_gateway', 'geoscore', 'umami', 'gsc')),
	status TEXT NOT NULL CHECK (status IN ('complete', 'partial', 'not_configured', 'error')),
	data_json TEXT NOT NULL DEFAULT 'null',
	error_code TEXT NOT NULL DEFAULT '',
	observed_at INTEGER NOT NULL,
	expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_snapshots_scope_time
	ON growth_snapshots (scope_type, scope_key, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_growth_snapshots_expiry
	ON growth_snapshots (expires_at);

CREATE TABLE IF NOT EXISTS growth_rollups (
	id TEXT PRIMARY KEY,
	year INTEGER NOT NULL,
	dimension_type TEXT NOT NULL,
	dimension_key TEXT NOT NULL,
	metrics_json TEXT NOT NULL DEFAULT '{}',
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_growth_rollups_dimension
	ON growth_rollups (year DESC, dimension_type, dimension_key);

CREATE TABLE IF NOT EXISTS growth_meta (
	key TEXT PRIMARY KEY,
	value TEXT NOT NULL,
	updated_at INTEGER NOT NULL
);
