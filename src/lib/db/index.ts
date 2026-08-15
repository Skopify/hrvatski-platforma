import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { DDL } from "./schema";
import * as schema from "./schema";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "hrvatski.db");

declare global {
  // eslint-disable-next-line no-var
  var __hrvatskiDb: ReturnType<typeof create> | undefined;
}

function create() {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(DDL);

  const now = Date.now();
  sqlite
    .prepare("INSERT OR IGNORE INTO profile (id, created_at) VALUES (1, ?)")
    .run(now);

  return { db: drizzle(sqlite, { schema }), sqlite };
}

// In dev hergebruikt Next de module tussen hot reloads; zonder cache zou elke
// reload een nieuwe SQLite-handle openen.
const instance = globalThis.__hrvatskiDb ?? create();
if (process.env.NODE_ENV !== "production") globalThis.__hrvatskiDb = instance;

export const db = instance.db;
export const sqlite = instance.sqlite;
export { schema };
