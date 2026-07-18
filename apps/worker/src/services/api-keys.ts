import { and, eq, isNull } from "drizzle-orm";

import type { Database } from "../db/client";
import { apiKeys } from "../db/schema";
import {
	canPrincipalGrantApiKeyScope,
	normalizeApiKeyScopes,
	parseStoredApiKeyScopes,
	type ApiKeyScope,
} from "../lib/auth/api-key-scopes";
import { buildSecret } from "../lib/auth/api-key";
import { hashSecret } from "../lib/auth/password";
import type { Principal } from "../lib/auth/types";
import type { LogContext } from "../lib/logs/context";
import { safeEmitLog } from "../lib/logs/emit";

type CreateApiKeyInput = {
	accountId: string;
	name: string;
	scopes: string[];
	principal: Principal;
};

function normalizeName(name: string): string {
	return name.trim() || "API key";
}

function assertRequestedScopesAllowed(
	principal: Principal,
	scopes: ApiKeyScope[],
): void {
	for (const scope of scopes) {
		if (!canPrincipalGrantApiKeyScope(principal, scope)) {
			throw new Error(`You cannot grant API key scope '${scope}'`);
		}
	}
}

export async function createApiKey(
	db: Database,
	input: CreateApiKeyInput,
	logContext?: LogContext | null,
) {
	const scopes = normalizeApiKeyScopes(input.scopes);
	if (scopes.length === 0) {
		throw new Error("At least one API key scope is required");
	}
	assertRequestedScopesAllowed(input.principal, scopes);

	const { secret, keyPrefix } = buildSecret();
	const id = crypto.randomUUID();
	const now = new Date();
	await db.insert(apiKeys).values({
		id,
		accountId: input.accountId,
		name: normalizeName(input.name),
		prefix: keyPrefix,
		keyHash: await hashSecret(secret),
		scopes,
		createdAt: now,
	});
	await safeEmitLog(db, {
		importance: 4,
		type: "api-keys",
		summary: "{actor} created API key {key}",
		refs: {
			actor: { kind: "account", id: input.accountId },
			key: { kind: "api-key", id },
		},
		actorAccountId: input.accountId,
		context: logContext ?? null,
	});
	return { id, secret, prefix: keyPrefix, scopes };
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
		scopes: parseStoredApiKeyScopes(row.scopes ?? []),
		createdAt: row.createdAt,
		lastUsedAt: row.lastUsedAt,
	}));
}

export async function revokeApiKey(
	db: Database,
	accountId: string,
	keyId: string,
	logContext?: LogContext | null,
): Promise<boolean> {
	const now = new Date();
	const revoked = await db
		.update(apiKeys)
		.set({ revokedAt: now })
		.where(
			and(
				eq(apiKeys.id, keyId),
				eq(apiKeys.accountId, accountId),
				isNull(apiKeys.revokedAt),
			),
		)
		.returning({ id: apiKeys.id });
	if (revoked.length > 0) {
		await safeEmitLog(db, {
			importance: 4,
			type: "api-keys",
			summary: "{actor} revoked API key {key}",
			refs: {
				actor: { kind: "account", id: accountId },
				key: { kind: "api-key", id: keyId },
			},
			actorAccountId: accountId,
			context: logContext ?? null,
		});
	}
	return revoked.length > 0;
}
