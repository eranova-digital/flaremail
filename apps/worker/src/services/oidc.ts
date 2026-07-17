import { createHash, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";

import type { Database } from "../db/client";
import {
	accountProfiles,
	accounts,
	oidcAuthorizationCodes,
	oidcClients,
	oidcConsentGrants,
	oidcPendingAuthorizations,
	oidcRefreshTokens,
	type OidcClient,
	type OidcPendingAuthorization,
} from "../db/schema";
import { randomToken } from "../lib/auth/crypto";
import { signOidcJwt } from "../lib/auth/oidc-signing";
import { hashSecret } from "../lib/auth/password";

export type { OidcPendingAuthorization };

export const OIDC_IDENTITY_SCOPES = ["openid", "profile", "email"] as const;
export const OIDC_MAIL_SCOPES = ["mail:read", "mail:send"] as const;
export const OIDC_SUPPORTED_SCOPES = [
	...OIDC_IDENTITY_SCOPES,
	...OIDC_MAIL_SCOPES,
] as const;

const AUTH_CODE_TTL_MS = 10 * 60 * 1000;
const PENDING_TTL_MS = 10 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ACCESS_EXPIRES_IN = 3600;

export class OidcError extends Error {
	constructor(
		message: string,
		readonly code:
			| "invalid_request"
			| "invalid_client"
			| "invalid_grant"
			| "unauthorized_client"
			| "access_denied"
			| "server_error"
			| "login_required"
			| "consent_required",
		readonly status = 400,
		readonly redirectSafe = false,
	) {
		super(message);
		this.name = "OidcError";
	}
}

export function issuerUrl(request: Request): string {
	const url = new URL(request.url);
	return `${url.protocol}//${url.host}`;
}

export function discoveryDocument(request: Request) {
	const issuer = issuerUrl(request);
	return {
		issuer,
		authorization_endpoint: `${issuer}/api/v1/oauth/authorize`,
		token_endpoint: `${issuer}/api/v1/oauth/token`,
		userinfo_endpoint: `${issuer}/api/v1/oauth/userinfo`,
		jwks_uri: `${issuer}/api/v1/oauth/jwks`,
		response_types_supported: ["code"],
		grant_types_supported: [
			"authorization_code",
			"refresh_token",
			"client_credentials",
		],
		code_challenge_methods_supported: ["S256"],
		scopes_supported: [...OIDC_SUPPORTED_SCOPES],
		token_endpoint_auth_methods_supported: [
			"client_secret_post",
			"client_secret_basic",
			"none",
		],
		subject_types_supported: ["public"],
		id_token_signing_alg_values_supported: ["ES256"],
	};
}

export function parseScopeList(scope: string | null | undefined): string[] {
	if (!scope?.trim()) {
		return ["openid", "profile", "email"];
	}
	return [...new Set(scope.split(/\s+/).filter(Boolean))];
}

export function intersectScopes(requested: string[], allowed: string[]): string[] {
	const allow = new Set(allowed);
	return requested.filter((scope) => allow.has(scope));
}

export function scopesCovered(granted: string[], requested: string[]): boolean {
	const set = new Set(granted);
	return requested.every((scope) => set.has(scope));
}

export function isExactRedirectUri(client: OidcClient, redirectUri: string): boolean {
	return client.redirectUris.includes(redirectUri);
}

function verifyPkce(challenge: string, method: string, verifier: string): boolean {
	if (method !== "S256" || !verifier) {
		return false;
	}
	const digest = createHash("sha256").update(verifier).digest("base64url");
	const expected = Buffer.from(digest);
	const actual = Buffer.from(challenge);
	if (expected.length !== actual.length) {
		return false;
	}
	return timingSafeEqual(expected, actual);
}

export async function getOidcClientByClientId(
	db: Database,
	clientId: string,
): Promise<OidcClient | null> {
	const [client] = await db
		.select()
		.from(oidcClients)
		.where(eq(oidcClients.clientId, clientId))
		.limit(1);
	return client ?? null;
}

export async function createPendingAuthorization(
	db: Database,
	input: {
		clientId: string;
		redirectUri: string;
		scopes: string[];
		state: string | null;
		nonce: string | null;
		codeChallenge: string;
		codeChallengeMethod: string;
	},
): Promise<OidcPendingAuthorization> {
	const now = new Date();
	const row = {
		id: crypto.randomUUID(),
		clientId: input.clientId,
		redirectUri: input.redirectUri,
		scopes: input.scopes,
		state: input.state,
		nonce: input.nonce,
		codeChallenge: input.codeChallenge,
		codeChallengeMethod: input.codeChallengeMethod,
		accountId: null as string | null,
		expiresAt: new Date(now.getTime() + PENDING_TTL_MS),
		createdAt: now,
	};
	await db.insert(oidcPendingAuthorizations).values(row);
	return row;
}

export async function getPendingAuthorization(
	db: Database,
	id: string,
): Promise<OidcPendingAuthorization | null> {
	const now = new Date();
	const [row] = await db
		.select()
		.from(oidcPendingAuthorizations)
		.where(
			and(
				eq(oidcPendingAuthorizations.id, id),
				gt(oidcPendingAuthorizations.expiresAt, now),
			),
		)
		.limit(1);
	return row ?? null;
}

export async function bindPendingAuthorizationAccount(
	db: Database,
	pendingId: string,
	accountId: string,
): Promise<void> {
	await db
		.update(oidcPendingAuthorizations)
		.set({ accountId })
		.where(eq(oidcPendingAuthorizations.id, pendingId));
}

export async function deletePendingAuthorization(
	db: Database,
	id: string,
): Promise<void> {
	await db
		.delete(oidcPendingAuthorizations)
		.where(eq(oidcPendingAuthorizations.id, id));
}

export async function getConsentGrant(
	db: Database,
	accountId: string,
	clientId: string,
) {
	const [grant] = await db
		.select()
		.from(oidcConsentGrants)
		.where(
			and(
				eq(oidcConsentGrants.accountId, accountId),
				eq(oidcConsentGrants.clientId, clientId),
			),
		)
		.limit(1);
	return grant ?? null;
}

export async function upsertConsentGrant(
	db: Database,
	input: { accountId: string; clientId: string; scopes: string[] },
): Promise<void> {
	const existing = await getConsentGrant(db, input.accountId, input.clientId);
	const now = new Date();
	if (existing) {
		const merged = [...new Set([...existing.scopes, ...input.scopes])];
		await db
			.update(oidcConsentGrants)
			.set({ scopes: merged, grantedAt: now })
			.where(eq(oidcConsentGrants.id, existing.id));
		return;
	}
	await db.insert(oidcConsentGrants).values({
		id: crypto.randomUUID(),
		accountId: input.accountId,
		clientId: input.clientId,
		scopes: input.scopes,
		grantedAt: now,
	});
}

export async function needsConsent(
	db: Database,
	client: OidcClient,
	accountId: string,
	scopes: string[],
): Promise<boolean> {
	if (!client.requireConsent) {
		return false;
	}
	const grant = await getConsentGrant(db, accountId, client.clientId);
	if (!grant) {
		return true;
	}
	return !scopesCovered(grant.scopes, scopes);
}

export async function createAuthorizationCode(
	db: Database,
	input: {
		clientId: string;
		accountId: string;
		redirectUri: string;
		scopes: string[];
		codeChallenge: string;
		codeChallengeMethod: string;
	},
): Promise<string> {
	const code = randomToken(24);
	const now = new Date();
	await db.insert(oidcAuthorizationCodes).values({
		id: crypto.randomUUID(),
		codeHash: await hashSecret(code),
		clientId: input.clientId,
		accountId: input.accountId,
		redirectUri: input.redirectUri,
		scopes: input.scopes,
		codeChallenge: input.codeChallenge,
		codeChallengeMethod: input.codeChallengeMethod,
		expiresAt: new Date(now.getTime() + AUTH_CODE_TTL_MS),
		createdAt: now,
	});
	return code;
}

export function buildClientRedirect(
	redirectUri: string,
	params: Record<string, string | undefined>,
): string {
	const target = new URL(redirectUri);
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined) {
			target.searchParams.set(key, value);
		}
	}
	return target.toString();
}

export async function completeAuthorization(
	db: Database,
	pending: OidcPendingAuthorization,
	accountId: string,
): Promise<string> {
	const code = await createAuthorizationCode(db, {
		clientId: pending.clientId,
		accountId,
		redirectUri: pending.redirectUri,
		scopes: pending.scopes,
		codeChallenge: pending.codeChallenge,
		codeChallengeMethod: pending.codeChallengeMethod,
	});
	await deletePendingAuthorization(db, pending.id);
	return buildClientRedirect(pending.redirectUri, {
		code,
		state: pending.state ?? undefined,
	});
}

export async function denyAuthorization(
	db: Database,
	pending: OidcPendingAuthorization,
): Promise<string> {
	await deletePendingAuthorization(db, pending.id);
	return buildClientRedirect(pending.redirectUri, {
		error: "access_denied",
		error_description: "The resource owner denied the request",
		state: pending.state ?? undefined,
	});
}

async function authenticateClient(
	db: Database,
	input: { clientId: string; clientSecret?: string },
): Promise<OidcClient> {
	const client = await getOidcClientByClientId(db, input.clientId);
	if (!client) {
		throw new OidcError("Invalid client", "invalid_client", 401);
	}
	if (client.isConfidential) {
		if (!input.clientSecret || !client.clientSecretHash) {
			throw new OidcError("Client authentication required", "invalid_client", 401);
		}
		const secretHash = await hashSecret(input.clientSecret);
		if (secretHash !== client.clientSecretHash) {
			throw new OidcError("Invalid client credentials", "invalid_client", 401);
		}
	}
	return client;
}

export async function exchangeAuthorizationCode(
	db: Database,
	env: Env,
	request: Request,
	input: {
		code: string;
		clientId: string;
		redirectUri: string;
		codeVerifier?: string;
		clientSecret?: string;
	},
) {
	const client = await authenticateClient(db, input);
	if (!input.codeVerifier) {
		throw new OidcError("code_verifier is required", "invalid_request");
	}

	const codeHash = await hashSecret(input.code);
	const now = new Date();
	const [authCode] = await db
		.select()
		.from(oidcAuthorizationCodes)
		.where(
			and(
				eq(oidcAuthorizationCodes.codeHash, codeHash),
				eq(oidcAuthorizationCodes.clientId, input.clientId),
				gt(oidcAuthorizationCodes.expiresAt, now),
				isNull(oidcAuthorizationCodes.usedAt),
			),
		)
		.limit(1);
	if (!authCode || authCode.redirectUri !== input.redirectUri) {
		throw new OidcError("Invalid authorization code", "invalid_grant");
	}
	if (
		!authCode.codeChallenge ||
		!authCode.codeChallengeMethod ||
		!verifyPkce(
			authCode.codeChallenge,
			authCode.codeChallengeMethod,
			input.codeVerifier,
		)
	) {
		throw new OidcError("Invalid PKCE verifier", "invalid_grant");
	}

	await db
		.update(oidcAuthorizationCodes)
		.set({ usedAt: now })
		.where(eq(oidcAuthorizationCodes.id, authCode.id));

	const scopes = intersectScopes(authCode.scopes, client.allowedScopes);
	return issueUserTokens(db, env, request, {
		accountId: authCode.accountId,
		clientId: client.clientId,
		scopes,
		familyId: crypto.randomUUID(),
	});
}

export async function exchangeClientCredentials(
	db: Database,
	env: Env,
	request: Request,
	input: { clientId: string; clientSecret?: string; scope?: string },
) {
	const client = await authenticateClient(db, {
		clientId: input.clientId,
		clientSecret: input.clientSecret,
	});
	if (!client.isConfidential) {
		throw new OidcError(
			"Public clients cannot use client_credentials",
			"unauthorized_client",
		);
	}
	const requested = parseScopeList(input.scope ?? client.m2mPermissions.join(" "));
	const scopes = intersectScopes(requested, client.m2mPermissions);
	const accessToken = await signOidcJwt(
		env,
		{
			typ: "client_credentials",
			client_id: client.clientId,
			scope: scopes.join(" "),
		},
		{
			issuer: issuerUrl(request),
			audience: client.clientId,
		},
	);
	return {
		access_token: accessToken,
		token_type: "Bearer",
		expires_in: ACCESS_EXPIRES_IN,
		scope: scopes.join(" "),
	};
}

export async function refreshUserToken(
	db: Database,
	env: Env,
	request: Request,
	input: { refreshToken: string; clientId: string; clientSecret?: string },
) {
	const client = await authenticateClient(db, input);
	const tokenHash = await hashSecret(input.refreshToken);
	const now = new Date();

	const [row] = await db
		.select()
		.from(oidcRefreshTokens)
		.where(
			and(
				eq(oidcRefreshTokens.tokenHash, tokenHash),
				eq(oidcRefreshTokens.clientId, input.clientId),
			),
		)
		.limit(1);

	if (!row) {
		throw new OidcError("Invalid refresh token", "invalid_grant");
	}

	if (row.revokedAt) {
		await db
			.update(oidcRefreshTokens)
			.set({ revokedAt: now })
			.where(
				and(
					eq(oidcRefreshTokens.familyId, row.familyId),
					isNull(oidcRefreshTokens.revokedAt),
				),
			);
		throw new OidcError("Refresh token reuse detected", "invalid_grant");
	}

	if (row.expiresAt <= now) {
		throw new OidcError("Refresh token expired", "invalid_grant");
	}

	await db
		.update(oidcRefreshTokens)
		.set({ revokedAt: now })
		.where(eq(oidcRefreshTokens.id, row.id));

	const scopes = intersectScopes(row.scopes, client.allowedScopes);
	return issueUserTokens(db, env, request, {
		accountId: row.accountId,
		clientId: row.clientId,
		scopes,
		familyId: row.familyId,
	});
}

async function issueUserTokens(
	db: Database,
	env: Env,
	request: Request,
	input: {
		accountId: string;
		clientId: string;
		scopes: string[];
		familyId: string;
	},
) {
	const [account] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.id, input.accountId))
		.limit(1);
	if (!account || account.status !== "active" || account.isIntendant) {
		throw new OidcError("Account cannot receive tokens", "access_denied");
	}
	const [profile] = await db
		.select()
		.from(accountProfiles)
		.where(eq(accountProfiles.accountId, account.id))
		.limit(1);

	const issuer = issuerUrl(request);
	const scope = input.scopes.join(" ");
	const displayName = profile
		? `${profile.firstName} ${profile.lastName}`.trim()
		: undefined;

	const accessToken = await signOidcJwt(
		env,
		{
			sub: account.id,
			client_id: input.clientId,
			scope,
			email: account.loginIdentifier,
			name: displayName,
		},
		{ issuer, audience: input.clientId },
	);

	const idToken = await signOidcJwt(
		env,
		{
			sub: account.id,
			email: account.loginIdentifier,
			name: displayName,
		},
		{ issuer, audience: input.clientId },
	);

	const refreshToken = randomToken(32);
	const now = new Date();
	await db.insert(oidcRefreshTokens).values({
		id: crypto.randomUUID(),
		tokenHash: await hashSecret(refreshToken),
		familyId: input.familyId,
		clientId: input.clientId,
		accountId: account.id,
		scopes: input.scopes,
		expiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
		createdAt: now,
	});

	return {
		access_token: accessToken,
		token_type: "Bearer",
		expires_in: ACCESS_EXPIRES_IN,
		refresh_token: refreshToken,
		id_token: idToken,
		scope,
	};
}

export async function getUserInfo(db: Database, accountId: string) {
	const [account] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);
	if (!account) {
		throw new OidcError("Account not found", "invalid_request", 404);
	}
	const [profile] = await db
		.select()
		.from(accountProfiles)
		.where(eq(accountProfiles.accountId, accountId))
		.limit(1);
	return {
		sub: account.id,
		email: account.loginIdentifier,
		name: profile ? `${profile.firstName} ${profile.lastName}`.trim() : undefined,
	};
}

export async function revokeConsentGrant(
	db: Database,
	accountId: string,
	clientId: string,
): Promise<boolean> {
	const grant = await getConsentGrant(db, accountId, clientId);
	if (!grant) {
		return false;
	}
	const now = new Date();
	await db.delete(oidcConsentGrants).where(eq(oidcConsentGrants.id, grant.id));
	await db
		.update(oidcRefreshTokens)
		.set({ revokedAt: now })
		.where(
			and(
				eq(oidcRefreshTokens.accountId, accountId),
				eq(oidcRefreshTokens.clientId, clientId),
				isNull(oidcRefreshTokens.revokedAt),
			),
		);
	return true;
}

export async function listConsentGrantsForAccount(db: Database, accountId: string) {
	const grants = await db
		.select({
			id: oidcConsentGrants.id,
			clientId: oidcConsentGrants.clientId,
			scopes: oidcConsentGrants.scopes,
			grantedAt: oidcConsentGrants.grantedAt,
			clientName: oidcClients.name,
		})
		.from(oidcConsentGrants)
		.leftJoin(oidcClients, eq(oidcConsentGrants.clientId, oidcClients.clientId))
		.where(eq(oidcConsentGrants.accountId, accountId));
	return grants.map((g) => ({
		id: g.id,
		clientId: g.clientId,
		clientName: g.clientName ?? g.clientId,
		scopes: g.scopes,
		grantedAt: g.grantedAt.toISOString(),
	}));
}

export async function listConsentGrantsForClient(db: Database, clientId: string) {
	const grants = await db
		.select({
			id: oidcConsentGrants.id,
			accountId: oidcConsentGrants.accountId,
			scopes: oidcConsentGrants.scopes,
			grantedAt: oidcConsentGrants.grantedAt,
			loginIdentifier: accounts.loginIdentifier,
		})
		.from(oidcConsentGrants)
		.innerJoin(accounts, eq(oidcConsentGrants.accountId, accounts.id))
		.where(eq(oidcConsentGrants.clientId, clientId));
	return grants.map((g) => ({
		id: g.id,
		accountId: g.accountId,
		loginIdentifier: g.loginIdentifier,
		scopes: g.scopes,
		grantedAt: g.grantedAt.toISOString(),
	}));
}

export async function cascadeDeleteOidcClient(
	db: Database,
	client: OidcClient,
): Promise<void> {
	const now = new Date();
	await db
		.delete(oidcConsentGrants)
		.where(eq(oidcConsentGrants.clientId, client.clientId));
	await db
		.delete(oidcPendingAuthorizations)
		.where(eq(oidcPendingAuthorizations.clientId, client.clientId));
	await db
		.delete(oidcAuthorizationCodes)
		.where(eq(oidcAuthorizationCodes.clientId, client.clientId));
	await db
		.update(oidcRefreshTokens)
		.set({ revokedAt: now })
		.where(
			and(
				eq(oidcRefreshTokens.clientId, client.clientId),
				isNull(oidcRefreshTokens.revokedAt),
			),
		);
	await db.delete(oidcClients).where(eq(oidcClients.id, client.id));
}
