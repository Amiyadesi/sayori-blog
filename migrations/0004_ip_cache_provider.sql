ALTER TABLE analytics_ip_cache ADD COLUMN provider TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE analytics_ip_cache ADD COLUMN risk_signals_known INTEGER NOT NULL DEFAULT 0;
ALTER TABLE analytics_events ADD COLUMN risk_signals_known INTEGER NOT NULL DEFAULT 0;
ALTER TABLE analytics_sessions ADD COLUMN risk_signals_known INTEGER NOT NULL DEFAULT 0;
