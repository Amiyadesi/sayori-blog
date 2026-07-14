CREATE TABLE IF NOT EXISTS analytics_events (
	id TEXT PRIMARY KEY,
	site TEXT NOT NULL CHECK (site IN ('blog', 'home')),
	event_type TEXT NOT NULL CHECK (event_type IN ('pageview', 'heartbeat')),
	visitor_hash TEXT NOT NULL,
	session_hash TEXT NOT NULL,
	ip_hash TEXT NOT NULL,
	path TEXT NOT NULL,
	title TEXT NOT NULL DEFAULT '',
	country_code TEXT,
	country_name TEXT,
	region TEXT,
	city TEXT,
	asn TEXT,
	organization TEXT,
	isp TEXT,
	connection_type TEXT,
	is_vpn INTEGER NOT NULL DEFAULT 0,
	is_proxy INTEGER NOT NULL DEFAULT 0,
	is_tor INTEGER NOT NULL DEFAULT 0,
	is_threat INTEGER NOT NULL DEFAULT 0,
	created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_site_time
	ON analytics_events (site, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type_time
	ON analytics_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_session_time
	ON analytics_events (session_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_page
	ON analytics_events (site, path, event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS analytics_sessions (
	session_hash TEXT PRIMARY KEY,
	visitor_hash TEXT NOT NULL,
	ip_hash TEXT NOT NULL,
	site TEXT NOT NULL CHECK (site IN ('blog', 'home')),
	first_seen_at INTEGER NOT NULL,
	last_seen_at INTEGER NOT NULL,
	last_event_type TEXT NOT NULL CHECK (last_event_type IN ('pageview', 'heartbeat')),
	current_path TEXT NOT NULL,
	current_title TEXT NOT NULL DEFAULT '',
	pageviews INTEGER NOT NULL DEFAULT 0,
	heartbeats INTEGER NOT NULL DEFAULT 0,
	country_code TEXT,
	country_name TEXT,
	region TEXT,
	city TEXT,
	asn TEXT,
	organization TEXT,
	isp TEXT,
	connection_type TEXT,
	is_vpn INTEGER NOT NULL DEFAULT 0,
	is_proxy INTEGER NOT NULL DEFAULT 0,
	is_tor INTEGER NOT NULL DEFAULT 0,
	is_threat INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_site_last_seen
	ON analytics_sessions (site, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_visitor
	ON analytics_sessions (visitor_hash, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS analytics_ip_cache (
	ip_hash TEXT PRIMARY KEY,
	country_code TEXT,
	country_name TEXT,
	region TEXT,
	city TEXT,
	asn TEXT,
	organization TEXT,
	isp TEXT,
	connection_type TEXT,
	is_vpn INTEGER NOT NULL DEFAULT 0,
	is_proxy INTEGER NOT NULL DEFAULT 0,
	is_tor INTEGER NOT NULL DEFAULT 0,
	is_threat INTEGER NOT NULL DEFAULT 0,
	looked_up_at INTEGER NOT NULL,
	expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analytics_ip_cache_expires
	ON analytics_ip_cache (expires_at);
