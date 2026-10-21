CREATE TABLE IF NOT EXISTS timetable_calendar (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  body TEXT NOT NULL CHECK (json_valid(body)),
  synced_at TEXT NOT NULL
);
