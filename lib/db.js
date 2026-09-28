const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

// Next.js "next build" imports this module (via lib/auth.js) just to
// statically analyze routes — it never serves a real request. If we let it
// create the real file here, that file gets created by the build process
// (running as root inside the Docker build stage), and ships inside the
// image owned by root even though the container later runs as an
// unprivileged user — so the real app can never write to it. During the
// build phase we use a scratch in-memory database instead; the real file is
// only ever created at actual runtime, by the user that will actually use it.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
const dbPath = isBuildPhase
  ? ":memory:"
  : process.env.DATABASE_PATH || path.join(process.cwd(), "data", "chalk.db");

if (!isBuildPhase) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new DatabaseSync(dbPath, { timeout: 5000 });
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'officer')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS officer_desk (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    note TEXT NOT NULL
  );
`);

module.exports = db;