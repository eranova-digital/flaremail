import { and, eq, gt, isNull } from "drizzle-orm";
import { jwtVerify } from "jose";

import { withDb } from "../../db/client";
import { apiKeys, oidcClients, sessions } from "../../db/schema";
import { parseCookies, SESSION_COOKIE_NAME } from "./cookies";
import { hashSecret } from "./password";
import { loadPrincipalForAccount } from "./principal";
import { touchSession } from "../../services/auth-session";
import type { Principal } from "./types";
import { problemResponse, requestInstance } from "../http/problem";

const API_KEY_PREFIX = "fm_";

export async function resolvePrincipal(
	request: Request,
	env: Env,
): Promise<Principal | Response> {
	const legacy = await tryLegacyBearer(request, env);
	if (legacy) {
		return legacy;
	}

	const apiKeyPrincipal = await tryApiKey(request, env);
	if (apiKeyPrincipal) {
		if (apiKeyPrincipal instanceof Response) {
			return apiKeyPrincipal;
		}
		return apiKeyPrincipal;
	}

	const oidcPrincipal = await tryOidcBearer(request, env);
	if (oidcPrincipal) {
		if (oidcPrincipal instanceof Response) {
			return oidcPrincipal;
		}
		return oidcPrincipal;
	}

	const sessionPrincipal = await trySession(request, env);
	if (sessionPrincipal) {
		if (sessionPrincipal instanceof Response) {
			return sessionPrincipal;
		}
		return sessionPrincipal;
	}

	return problemResponse(401, "Authentication required", {
		code: "unauthorized",
		instance: requestInstance(request),
	});
}

async function tryLegacyBearer(
	request: Request,
	env: Env,
): Promise<Principal | null> {
	const header = request.headers.get("Authorization");
	if (!header?.startsWith("Bearer ") || !env.API_BEARER_TOKEN) {
		return null;
	}
	const token = header.slice("Bearer ".length).trim();
	if (token !== env.API_BEARER_TOKEN || token.startsWith(API_KEY_PREFIX)) {
		return null;
	}
	return {
		kind: "legacy",
		accountId: null,
		isIntendant: true,
		role: "superadmin",
		status: "active",
		loginIdentifier: null,
		primaryMailboxId: null,
		domainIds: [],
		grantMailboxIds: [],
		sharedMailboxAssignment: [],
	};
}

async function tryApiKey(
	request: Request,
	env: Env,
): Promise<Principal | Response | null> {
	const header = request.headers.get("Authorization");
	if (!header?.startsWith("Bearer ")) {
		return null;
	}
	const token = header.slice("Bearer ".length).trim();
	if (!token.startsWith(API_KEY_PREFIX)) {
		return null;
	}

	return withDb(env, async (db) => {
		const prefix = token.slice(0, 11);
		const [row] = await db
			.select()
			.from(apiKeys)
			.where(and(eq(apiKeys.prefix, prefix), isNull(apiKeys.revokedAt)))
			.limit(1);
		if (!row) {
			return problemResponse(401, "Invalid API key", {
				code: "unauthorized",
				instance: requestInstance(request),
			});
		}
		const tokenHash = await hashSecret(token);
		if (tokenHash !== row.keyHash) {
			return problemResponse(401, "Invalid API key", {
				code: "unauthorized",
				instance: requestInstance(request),
			});
		}
		const principal = await loadPrincipalForAccount(db, row.accountId, "api_key");
		if (!principal || principal.status === "suspended") {
			return problemResponse(401, "Invalid API key", {
				code: "unauthorized",
				instance: requestInstance(request),
			});
		}
		return principal;
	});
}

async function tryOidcBearer(
	request: Request,
	env: Env,
): Promise<Principal | Response | null> {
	const header = request.headers.get("Authorization");
	if (!header?.startsWith("Bearer ")) {
		return null;
	}
	const token = header.slice("Bearer ".length).trim();
	if (token.startsWith(API_KEY_PREFIX)) {
		return null;
	}

	try {
		const secret = new TextEncoder().encode(requireSessionSecret(env));
		const { payload } = await jwtVerify(token, secret);
		if (payload.typ === "client_credentials") {
			return withDb(env, async (db) => {
				const clientId = String(payload.client_id ?? "");
				const [client] = await db
					.select()
					.from(oidcClients)
					.where(eq(oidcClients.clientId, clientId))
					.limit(1);
				if (!client) {
					return problemResponse(401, "Invalid token", {
						code: "unauthorized",
						instance: requestInstance(request),
					});
				}
				return {
					kind: "oidc_client" as const,
					accountId: null,
					isIntendant: false,
					role: null,
					status: null,
					loginIdentifier: null,
					primaryMailboxId: null,
					domainIds: [],
					grantMailboxIds: [],
					sharedMailboxAssignment: [],
					oidcClientId: client.clientId,
					m2mPermissions: client.m2mPermissions,
				};
			});
		}

		const accountId = String(payload.sub ?? "");
		return withDb(env, async (db) => {
			const principal = await loadPrincipalForAccount(db, accountId, "oidc_user", {
				oidcScopes: Array.isArray(payload.scope)
					? payload.scope.map(String)
					: String(payload.scope ?? "")
							.split(" ")
							.filter(Boolean),
				oidcClientId: String(payload.client_id ?? ""),
			});
			if (!principal || principal.status === "suspended") {
				return problemResponse(401, "Invalid token", {
					code: "unauthorized",
					instance: requestInstance(request),
				});
			}
			return principal;
		});
	} catch {
		return null;
	}
}

async function trySession(
	request: Request,
	env: Env,
): Promise<Principal | Response | null> {
	const cookies = parseCookies(request.headers.get("Cookie"));
	const token = cookies[SESSION_COOKIE_NAME];
	if (!token) {
		return null;
	}

	return withDb(env, async (db) => {
		const tokenHash = await hashSecret(token);
		const now = new Date();
		const [row] = await db
			.select()
			.from(sessions)
			.where(
				and(
					eq(sessions.tokenHash, tokenHash),
					gt(sessions.expiresAt, now),
					gt(sessions.absoluteExpiresAt, now),
				),
			)
			.limit(1);
		if (!row) {
			return problemResponse(401, "Session expired", {
				code: "unauthorized",
				instance: requestInstance(request),
			});
		}
		await touchSession(db, row.id, row.lastSeenAt);
		const principal = await loadPrincipalForAccount(db, row.accountId, "session", {
			sessionId: row.id,
		});
		if (!principal || principal.status === "suspended") {
			return problemResponse(401, "Session invalid", {
				code: "unauthorized",
				instance: requestInstance(request),
			});
		}
		return principal;
	});
}

export function requireSessionSecret(env: Env): string {
	const secret = env.SESSION_SECRET;
	if (!secret) {
		throw new Error("SESSION_SECRET is not configured");
	}
	return secret;
}
