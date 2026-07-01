import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Client } from "pg";

import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

export async function withDb<T>(
	env: Env,
	fn: (db: Database) => Promise<T>,
): Promise<T> {
	const client = new Client({
		connectionString: env.HYPERDRIVE.connectionString,
	});

	await client.connect();
	const db = drizzle(client, { schema });

	try {
		return await fn(db);
	} finally {
		await client.end();
	}
}
