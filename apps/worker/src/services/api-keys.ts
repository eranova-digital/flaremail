import { and, eq, isNull } from "drizzle-orm";

import type { Database } from "../db/client";
import { apiKeys } from "../db/schema";
import { randomToken } from "../lib/auth/crypto";
import { hashSecret } from "../lib/auth/password";

const API_KEY_PREFIX = "fm_";

export async function createApiKey(
	db: Database,
	accountId: string,
	name: string,
) {
	const secret = `${API_KEY_PREFIX}${randomToken(24)}`;
	const prefix = secret.slice(0, 11);
	const now = new Date();
	await db.insert(apiKeys).values({
		id: crypto.randomUUID(),
		accountId,
		name: name.trim() || "API key",
		prefix,
		keyHash: await hashSecret(secret),
		createdAt: now,
	});
	return { secret, prefix };
}

export async function listApiKeys(db: Database, accountId: string) {
	const rows = await db
		.select()
		.from(apiKeys)
		.where(and(eq(apiKeys.accountId, accountId), isNull(apiKeys.revokedAt)))
		.orderBy(apiKeys.createdAt);
	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		prefix: row.prefix,
		createdAt: row.createdAt,
		lastUsedAt: row.lastUsedAt,
	}));
}

export async function revokeApiKey(db: Database, accountId: string, keyId: string) {
	const now = new Date();
	await db
		.update(apiKeys)
		.set({ revokedAt: now })
		.where(and(eq(apiKeys.id, keyId), eq(apiKeys.accountId, accountId)));
}
