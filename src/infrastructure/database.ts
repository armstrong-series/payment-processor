import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const databaseFile = process.env.DATABASE_FILE ?? "data/database.sqlite";

fs.mkdirSync(path.dirname(databaseFile), {
  recursive: true,
});

export const db = new Database(databaseFile);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

db.exec(`
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    amount REAL NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL CHECK (
      status IN ('pending', 'processing', 'succeeded', 'failed')
    ),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS outbox_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    delivered_at TEXT,
    next_attempt_at TEXT NOT NULL,
    last_error TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_outbox_pending
    ON outbox_events(delivered_at, next_attempt_at, created_at);
`);
