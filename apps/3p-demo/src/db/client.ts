import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./auth-schema";

const databaseUrl = process.env.DATABASE_URL ?? "./data/3p-demo.sqlite";
const resolvedPath = path.isAbsolute(databaseUrl)
	? databaseUrl
	: path.join(/* turbopackIgnore: true */ process.cwd(), databaseUrl);

fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });

const sqlite = new Database(resolvedPath);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
