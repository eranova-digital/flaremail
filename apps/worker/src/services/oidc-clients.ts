import { eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { oidcClients, type OidcClient } from "../db/schema";
import { randomToken } from "../lib/auth/crypto";
import { hashSecret } from "../lib/auth/password";
import {
	cascadeDeleteOidcClient,
	OIDC_SUPPORTED_SCOPES,
} from "./oidc";

export type OidcClientPublic = {
	id: string;
	clientId: string;
	name: string;
	redirectUris: string[];
	allowedScopes: string[];
	m2mPermissions: string[];
	isConfidential: boolean;
	requireConsent: boolean;
	createdAt: string;
	updatedAt: string;
};

function toPublic(client: OidcClient): OidcClientPublic {
	return {
		id: client.id,
		clientId: client.clientId,
		name: client.name,
		redirectUris: client.redirectUris,
		allowedScopes: client.allowedScopes,
		m2mPermissions: client.m2mPermissions,
		isConfidential: client.isConfidential,
		requireConsent: client.requireConsent,
		createdAt: client.createdAt.toISOString(),
		updatedAt: client.updatedAt.toISOString(),
	};
}

function assertScopes(scopes: string[], field: string): void {
	const allowed = new Set<string>(OIDC_SUPPORTED_SCOPES);
	for (const scope of scopes) {
		if (!allowed.has(scope) && field === "allowedScopes") {
			throw new Error(`Unsupported scope '${scope}'`);
		}
	}
}

export async function createOidcClientRecord(
	db: Database,
	input: {
		name: string;
		redirectUris: string[];
		allowedScopes: string[];
		m2mPermissions?: string[];
		isConfidential?: boolean;
		requireConsent?: boolean;
		createdByAccountId?: string | null;
	},
): Promise<OidcClientPublic & { clientSecret: string | null }> {
	if (!input.name.trim()) {
		throw new Error("name is required");
	}
	if (input.redirectUris.length === 0) {
		throw new Error("redirectUris must not be empty");
	}
	assertScopes(input.allowedScopes, "allowedScopes");

	const isConfidential = input.isConfidential ?? true;
	const clientId = `client_${randomToken(8)}`;
	const clientSecret = isConfidential ? randomToken(24) : null;
	const id = crypto.randomUUID();
	const now = new Date();
	await db.insert(oidcClients).values({
		id,
		clientId,
		clientSecretHash: clientSecret ? await hashSecret(clientSecret) : null,
		name: input.name.trim(),
		redirectUris: input.redirectUris,
		allowedScopes: input.allowedScopes,
		m2mPermissions: input.m2mPermissions ?? [],
		isConfidential,
		requireConsent: input.requireConsent ?? true,
		createdByAccountId: input.createdByAccountId ?? null,
		createdAt: now,
		updatedAt: now,
	});
	const [created] = await db
		.select()
		.from(oidcClients)
		.where(eq(oidcClients.id, id))
		.limit(1);
	return { ...toPublic(created!), clientSecret };
}

export async function listOidcClients(db: Database): Promise<OidcClientPublic[]> {
	const rows = await db.select().from(oidcClients);
	return rows.map(toPublic);
}

export async function getOidcClientById(
	db: Database,
	id: string,
): Promise<OidcClientPublic | null> {
	const [row] = await db
		.select()
		.from(oidcClients)
		.where(eq(oidcClients.id, id))
		.limit(1);
	return row ? toPublic(row) : null;
}

export async function getOidcClientRowById(
	db: Database,
	id: string,
): Promise<OidcClient | null> {
	const [row] = await db
		.select()
		.from(oidcClients)
		.where(eq(oidcClients.id, id))
		.limit(1);
	return row ?? null;
}

export async function updateOidcClient(
	db: Database,
	id: string,
	input: {
		name?: string;
		redirectUris?: string[];
		allowedScopes?: string[];
		m2mPermissions?: string[];
		isConfidential?: boolean;
		requireConsent?: boolean;
	},
): Promise<OidcClientPublic | null> {
	const existing = await getOidcClientRowById(db, id);
	if (!existing) {
		return null;
	}
	if (input.allowedScopes) {
		assertScopes(input.allowedScopes, "allowedScopes");
	}
	if (input.redirectUris && input.redirectUris.length === 0) {
		throw new Error("redirectUris must not be empty");
	}

	const now = new Date();
	const isConfidential = input.isConfidential ?? existing.isConfidential;
	let clientSecretHash = existing.clientSecretHash;

	if (input.isConfidential === false) {
		clientSecretHash = null;
	} else if (input.isConfidential === true && !existing.isConfidential) {
		// Becoming confidential without a secret — caller should regenerate.
		clientSecretHash = null;
	}

	await db
		.update(oidcClients)
		.set({
			name: input.name?.trim() ?? existing.name,
			redirectUris: input.redirectUris ?? existing.redirectUris,
			allowedScopes: input.allowedScopes ?? existing.allowedScopes,
			m2mPermissions: input.m2mPermissions ?? existing.m2mPermissions,
			isConfidential,
			requireConsent: input.requireConsent ?? existing.requireConsent,
			clientSecretHash,
			updatedAt: now,
		})
		.where(eq(oidcClients.id, id));

	return getOidcClientById(db, id);
}

export async function regenerateOidcClientSecret(
	db: Database,
	id: string,
): Promise<{ clientId: string; clientSecret: string } | null> {
	const existing = await getOidcClientRowById(db, id);
	if (!existing) {
		return null;
	}
	if (!existing.isConfidential) {
		throw new Error("Public clients do not have secrets");
	}
	const clientSecret = randomToken(24);
	await db
		.update(oidcClients)
		.set({
			clientSecretHash: await hashSecret(clientSecret),
			updatedAt: new Date(),
		})
		.where(eq(oidcClients.id, id));
	return { clientId: existing.clientId, clientSecret };
}

export async function deleteOidcClient(
	db: Database,
	id: string,
): Promise<boolean> {
	const existing = await getOidcClientRowById(db, id);
	if (!existing) {
		return false;
	}
	await cascadeDeleteOidcClient(db, existing);
	return true;
}
