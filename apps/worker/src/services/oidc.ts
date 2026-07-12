import { SignJWT, jwtVerify } from "jose";
import { and, eq, gt, isNull } from "drizzle-orm";
import { createHash, timingSafeEqual } from "node:crypto";

import type { Database } from "../db/client";
import {
	accountProfiles,
	accounts,
	oidcAuthorizationCodes,
	oidcClients,
	oidcRefreshTokens,
} from "../db/schema";
import { randomToken } from "../lib/auth/crypto";
import { hashSecret } from "../lib/auth/password";
import { requireSessionSecret } from "../lib/auth/resolve-principal";

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
		scopes_supported: ["openid", "profile", "email", "mail:read", "mail:send"],
		token_endpoint_auth_methods_supported: [
			"client_secret_post",
			"client_secret_basic",
			"none",
		],
		subject_types_supported: ["public"],
		id_token_signing_alg_values_supported: ["HS256"],
	};
}

export async function createOidcClient(
	db: Database,
	input: {
		name: string;
		redirectUris: string[];
		allowedScopes: string[];
		m2mPermissions?: string[];
		isConfidential?: boolean;
	},
) {
	const clientId = `client_${randomToken(8)}`;
	const clientSecret = input.isConfidential === false ? null : randomToken(24);
	const id = crypto.randomUUID();
	const now = new Date();
	await db.insert(oidcClients).values({
		id,
		clientId,
		clientSecretHash: clientSecret ? await hashSecret(clientSecret) : null,
		name: input.name,
		redirectUris: input.redirectUris,
		allowedScopes: input.allowedScopes,
		m2mPermissions: input.m2mPermissions ?? [],
		isConfidential: input.isConfidential ?? true,
		createdAt: now,
		updatedAt: now,
	});
	return { clientId, clientSecret };
}

export async function createAuthorizationCode(
	db: Database,
	input: {
		clientId: string;
		accountId: string;
		redirectUri: string;
		scopes: string[];
		codeChallenge?: string;
		codeChallengeMethod?: string;
	},
) {
	const code = randomToken(24);
	const now = new Date();
	await db.insert(oidcAuthorizationCodes).values({
		id: crypto.randomUUID(),
		codeHash: await hashSecret(code),
		clientId: input.clientId,
		accountId: input.accountId,
		redirectUri: input.redirectUri,
		scopes: input.scopes,
		codeChallenge: input.codeChallenge ?? null,
		codeChallengeMethod: input.codeChallengeMethod ?? null,
		expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
		createdAt: now,
	});
	return code;
}

function verifyPkce(
	challenge: string | null,
	method: string | null,
	verifier: string,
): boolean {
	if (!challenge) {
		return true;
	}
	if (method !== "S256") {
		return false;
	}
	const digest = createHash("sha256").update(verifier).digest("base64url");
	return timingSafeEqual(Buffer.from(digest), Buffer.from(challenge));
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
	const [client] = await db
		.select()
		.from(oidcClients)
		.where(eq(oidcClients.clientId, input.clientId))
		.limit(1);
	if (!client) {
		throw new Error("Invalid client");
	}
	if (client.isConfidential) {
		if (!input.clientSecret || !client.clientSecretHash) {
			throw new Error("Client authentication required");
		}
		const secretHash = await hashSecret(input.clientSecret);
		if (secretHash !== client.clientSecretHash) {
			throw new Error("Invalid client credentials");
		}
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
		throw new Error("Invalid authorization code");
	}
	if (
		!verifyPkce(
			authCode.codeChallenge,
			authCode.codeChallengeMethod,
			input.codeVerifier ?? "",
		)
	) {
		throw new Error("Invalid PKCE verifier");
	}

	await db
		.update(oidcAuthorizationCodes)
		.set({ usedAt: now })
		.where(eq(oidcAuthorizationCodes.id, authCode.id));

	return issueUserTokens(db, env, request, {
		accountId: authCode.accountId,
		clientId: client.clientId,
		scopes: authCode.scopes,
	});
}

export async function exchangeClientCredentials(
	db: Database,
	env: Env,
	request: Request,
	input: { clientId: string; clientSecret?: string; scope?: string },
) {
	const [client] = await db
		.select()
		.from(oidcClients)
		.where(eq(oidcClients.clientId, input.clientId))
		.limit(1);
	if (!client?.clientSecretHash || !input.clientSecret) {
		throw new Error("Invalid client");
	}
	const secretHash = await hashSecret(input.clientSecret);
	if (secretHash !== client.clientSecretHash) {
		throw new Error("Invalid client credentials");
	}
	const secret = new TextEncoder().encode(requireSessionSecret(env));
	const accessToken = await new SignJWT({
		typ: "client_credentials",
		client_id: client.clientId,
		scope: input.scope ?? client.m2mPermissions.join(" "),
	})
		.setProtectedHeader({ alg: "HS256" })
		.setIssuer(issuerUrl(request))
		.setAudience(client.clientId)
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(secret);
	return {
		access_token: accessToken,
		token_type: "Bearer",
		expires_in: 3600,
		scope: input.scope ?? client.m2mPermissions.join(" "),
	};
}

export async function refreshUserToken(
	db: Database,
	env: Env,
	request: Request,
	input: { refreshToken: string; clientId: string },
) {
	const tokenHash = await hashSecret(input.refreshToken);
	const now = new Date();
	const [row] = await db
		.select()
		.from(oidcRefreshTokens)
		.where(
			and(
				eq(oidcRefreshTokens.tokenHash, tokenHash),
				eq(oidcRefreshTokens.clientId, input.clientId),
				gt(oidcRefreshTokens.expiresAt, now),
				isNull(oidcRefreshTokens.revokedAt),
			),
		)
		.limit(1);
	if (!row) {
		throw new Error("Invalid refresh token");
	}
	return issueUserTokens(db, env, request, {
		accountId: row.accountId,
		clientId: row.clientId,
		scopes: row.scopes,
	});
}

async function issueUserTokens(
	db: Database,
	env: Env,
	request: Request,
	input: { accountId: string; clientId: string; scopes: string[] },
) {
	const [account] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.id, input.accountId))
		.limit(1);
	if (!account || account.status !== "active" || account.isIntendant) {
		throw new Error("Account cannot receive tokens");
	}
	const [profile] = await db
		.select()
		.from(accountProfiles)
		.where(eq(accountProfiles.accountId, account.id))
		.limit(1);

	const secret = new TextEncoder().encode(requireSessionSecret(env));
	const issuer = issuerUrl(request);
	const scope = input.scopes.join(" ");
	const accessToken = await new SignJWT({
		sub: account.id,
		client_id: input.clientId,
		scope,
		email: account.loginIdentifier,
		name: profile ? `${profile.firstName} ${profile.lastName}`.trim() : undefined,
	})
		.setProtectedHeader({ alg: "HS256" })
		.setIssuer(issuer)
		.setAudience(input.clientId)
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(secret);

	const idToken = await new SignJWT({
		sub: account.id,
		email: account.loginIdentifier,
		name: profile ? `${profile.firstName} ${profile.lastName}`.trim() : undefined,
	})
		.setProtectedHeader({ alg: "HS256" })
		.setIssuer(issuer)
		.setAudience(input.clientId)
		.setIssuedAt()
		.setExpirationTime("1h")
		.sign(secret);

	const refreshToken = randomToken(32);
	const now = new Date();
	await db.insert(oidcRefreshTokens).values({
		id: crypto.randomUUID(),
		tokenHash: await hashSecret(refreshToken),
		clientId: input.clientId,
		accountId: account.id,
		scopes: input.scopes,
		expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
		createdAt: now,
	});

	return {
		access_token: accessToken,
		token_type: "Bearer",
		expires_in: 3600,
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
		throw new Error("Account not found");
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

export async function verifyAccessToken(env: Env, request: Request, token: string) {
	const secret = new TextEncoder().encode(requireSessionSecret(env));
	const { payload } = await jwtVerify(token, secret);
	return payload;
}
