import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

export function escapeIlike(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function ilikeContains(column: SQL, value: string): SQL {
	return sql`${column} ILIKE ${`%${escapeIlike(value)}%`} ESCAPE '\\'`;
}

export function ilikeSuffix(column: SQL, suffix: string): SQL {
	return sql`lower(${column}) LIKE ${`%${escapeIlike(suffix.toLowerCase())}`} ESCAPE '\\'`;
}
