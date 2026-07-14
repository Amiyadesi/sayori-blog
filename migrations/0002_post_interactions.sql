CREATE TABLE IF NOT EXISTS post_likes (
	path TEXT NOT NULL,
	visitor_hash TEXT NOT NULL,
	created_at INTEGER NOT NULL,
	PRIMARY KEY (path, visitor_hash)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_created_at
	ON post_likes (created_at DESC);

CREATE TABLE IF NOT EXISTS post_interaction_events (
	id TEXT PRIMARY KEY,
	path TEXT NOT NULL,
	action TEXT NOT NULL CHECK (action IN ('like', 'reward', 'share')),
	target TEXT NOT NULL,
	visitor_hash TEXT NOT NULL,
	ip_hash TEXT NOT NULL,
	created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_post_interaction_events_path_time
	ON post_interaction_events (path, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_interaction_events_action_time
	ON post_interaction_events (action, created_at DESC);

CREATE TABLE IF NOT EXISTS post_interaction_totals (
	path TEXT PRIMARY KEY,
	likes INTEGER NOT NULL DEFAULT 0,
	reward_clicks INTEGER NOT NULL DEFAULT 0,
	share_clicks INTEGER NOT NULL DEFAULT 0,
	updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_post_interaction_totals_likes
	ON post_interaction_totals (likes DESC);

CREATE INDEX IF NOT EXISTS idx_post_interaction_totals_reward_clicks
	ON post_interaction_totals (reward_clicks DESC);

CREATE INDEX IF NOT EXISTS idx_post_interaction_totals_share_clicks
	ON post_interaction_totals (share_clicks DESC);
