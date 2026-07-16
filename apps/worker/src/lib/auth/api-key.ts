import { and, eq, isNull } from "drizzle-orm";

import type { Database } from "../../db/client";
import { apiKeys } from "../../db/schema";
import { problemResponse } from "../http/problem";
import { parseStoredApiKeyScopes } from "./api-key-scopes";
import { randomToken } from "./crypto";
import { hashSecret } from "./password";
import { loadPrincipalForAccount } from "./principal";
import type { Principal } from "./types";

export const API_KEY_PREFIX = "fmu_";
export const KEY_PREFIX_LENGTH = 16;

export function buildSecret() {
	const secret = `${API_KEY_PREFIX}${randomToken(24)}`;
	return {
		secret,
		keyPrefix: secret.slice(0, KEY_PREFIX_LENGTH),
	};
}

/** Resolve a raw API key token to a principal, or an auth problem response. */
export async function resolveApiKeyPrincipal(
	db: Database,
	token: string,
	options?: { instance?: string },
): Promise<Principal | Response | null> {
	if (!token.startsWith(API_KEY_PREFIX)) {
		return null;
	}

	const prefix = token.slice(0, KEY_PREFIX_LENGTH);
	const [row] = await db
		.select()
		.from(apiKeys)
		.where(and(eq(apiKeys.prefix, prefix), isNull(apiKeys.revokedAt)))
		.limit(1);
	if (!row) {
		return problemResponse(401, "Invalid API key", {
			code: "unauthorized",
			instance: options?.instance,
		});
	}
	const tokenHash = await hashSecret(token);
	if (tokenHash !== row.keyHash) {
		return problemResponse(401, "Invalid API key", {
			code: "unauthorized",
			instance: options?.instance,
		});
	}

	await db
		.update(apiKeys)
		.set({ lastUsedAt: new Date() })
		.where(eq(apiKeys.id, row.id));

	const scopes = parseStoredApiKeyScopes(row.scopes ?? []);
	const principal = await loadPrincipalForAccount(db, row.accountId, "api_key", {
		apiKeyId: row.id,
		apiKeyScopes: scopes,
	});
	if (!principal || principal.status === "suspended") {
		return problemResponse(401, "Invalid API key", {
			code: "unauthorized",
			instance: options?.instance,
		});
	}
	return principal;
}
