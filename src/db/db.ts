import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const DATA_DIR = join(__dirname, "..", "..", "data");
export const RAW_DIR = join(DATA_DIR, "raw");
export const DB_PATH = join(DATA_DIR, "gitcric.db");

export const SCHEMA_VERSION = "1";

export type DB = Database.Database;

/** Open (creating if needed) the GitCric database and apply the schema. */
export function openDb(path: string = DB_PATH): DB {
  mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");

  const schema = readFileSync(join(__dirname, "schema.sql"), "utf8");
  db.exec(schema);

  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").run("schema_version", SCHEMA_VERSION);
  return db;
}
