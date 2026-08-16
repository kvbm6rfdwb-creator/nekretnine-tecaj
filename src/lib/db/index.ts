import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import * as path from "path";

const sqlite = new Database(path.join(process.cwd(), "nekretnine.db"));
sqlite.pragma("journal_mode = WAL");
export const db = drizzle(sqlite, { schema });
