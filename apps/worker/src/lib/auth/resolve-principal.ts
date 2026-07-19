import { and, eq, gt } from "drizzle-orm";

import { withDb } from "../../db/client";
import { oidcClients, sessions } from "../../db/schema";
import { API_KEY_PREFIX, resolveApiKeyPrincipal } from "./api-key";
import { parseCookies, SESSION_COOKIE_NAME } from "./cookies";
import { verifyOidcJwt } from "./oidc-signing";
import { hashSecret } from "./password";
import { loadPrincipalForAccount } from "./principal";
import type { Principal } from "./types";
import { problemResponse, requestInstance } from "../http/problem";

export type TouchSession = (
	db: import("../../db/client").Database,
	sessionId: string,
	lastSeenAt: Date,
) => Promise<void>;

export type ResolvePrincipalDeps = {
	touchSession?: TouchSession;
};

const noopTouchSession: TouchSession = async () => {};

export async function resolvePrincipal(
	request: Request,
	env: Env,
	deps: ResolvePrincipalDeps = {},
): Promise<Principal | Response> {
	const touchSessionFn = deps.touchSession ?? noopTouchSession;
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

	const sessionPrincipal = await trySession(request, env, touchSessionFn);
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

/** Session cookie only — no 401 when missing (for OIDC authorize). */
export async function tryResolveSessionPrincipal(
	request: Request,
	env: Env,
	deps: ResolvePrincipalDeps = {},
): Promise<Principal | null> {
	const touchSessionFn = deps.touchSession ?? noopTouchSession;
	const result = await trySession(request, env, touchSessionFn);
	if (!result || result instanceof Response) {
		return null;
	}
	return result;
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

	return withDb(env, (db) =>
		resolveApiKeyPrincipal(db, token, {
			instance: requestInstance(request),
		}),
	);
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
		const { payload } = await verifyOidcJwt(env, token);
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
				const tokenScopes = String(payload.scope ?? "")
					.split(/\s+/)
					.filter(Boolean);
				const allowed = new Set(client.m2mPermissions);
				const m2mPermissions = tokenScopes.filter((scope) =>
					allowed.has(scope),
				);
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
					m2mPermissions,
				};
			});
		}

		if (payload.typ !== "access") {
			return problemResponse(401, "Invalid token", {
				code: "unauthorized",
				instance: requestInstance(request),
			});
		}

		const accountId = typeof payload.sub === "string" ? payload.sub : null;
		if (!accountId) {
			return problemResponse(401, "Invalid token", {
				code: "unauthorized",
				instance: requestInstance(request),
			});
		}
		return withDb(env, async (db) => {
			const principal = await loadPrincipalForAccount(db, accountId, "oidc_user", {
				oidcScopes: String(payload.scope ?? "")
					.split(/\s+/)
					.filter(Boolean),
				oidcClientId:
					typeof payload.client_id === "string" ? payload.client_id : undefined,
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
		return problemResponse(401, "Invalid token", {
			code: "unauthorized",
			instance: requestInstance(request),
		});
	}
}

async function trySession(
	request: Request,
	env: Env,
	touchSessionFn: TouchSession,
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
		await touchSessionFn(db, row.id, row.lastSeenAt);
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
