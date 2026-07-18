import { createHash, randomBytes } from "node:crypto";

import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { withDb } from "../src/db/client";
import type { Database } from "../src/db/client";
import { accounts, oidcPendingAuthorizations } from "../src/db/schema";
import type { Principal } from "../src/lib/auth/types";
import { clearOidcSigningKeyCache } from "../src/lib/auth/oidc-signing";
import { createOidcClientRecord } from "../src/services/oidc-clients";
import {
	decideConsent,
	exchangeAuthorizationCode,
	OidcError,
	startAuthorization,
} from "../src/services/oidc";

const REDIRECT_URI = "https://app.example/callback";
const WEB_ORIGIN = "https://mail.example.com";

function createPkcePair() {
	const verifier = randomBytes(32).toString("base64url");
	const challenge = createHash("sha256").update(verifier).digest("base64url");
	return { verifier, challenge };
}

function sessionPrincipal(
	accountId: string,
	overrides: Partial<Principal> = {},
): Principal {
	return {
		kind: "session",
		accountId,
		isIntendant: false,
		role: "user",
		status: "active",
		loginIdentifier: `${accountId}@example.com`,
		primaryMailboxId: null,
		domainIds: [],
		grantMailboxIds: [],
		sharedMailboxAssignment: [],
		...overrides,
	};
}

async function createAccount(
	db: Database,
	overrides: { isIntendant?: boolean; status?: "active" | "suspended" } = {},
) {
	const accountId = crypto.randomUUID();
	const now = new Date();
	await db.insert(accounts).values({
		id: accountId,
		isIntendant: overrides.isIntendant ?? false,
		role: "user",
		status: overrides.status ?? "active",
		loginIdentifier: `${accountId}@example.com`,
		passwordHash: null,
		primaryMailboxId: null,
		createdAt: now,
		updatedAt: now,
		activatedAt: now,
		suspendedAt: null,
	});
	return accountId;
}

async function createTestClient(
	db: Parameters<typeof createOidcClientRecord>[0],
	options: { requireConsent?: boolean } = {},
) {
	return createOidcClientRecord(db, {
		name: "Test App",
		redirectUris: [REDIRECT_URI],
		allowedScopes: ["openid", "profile", "email", "mail:read"],
		requireConsent: options.requireConsent ?? false,
		isConfidential: true,
	});
}

function authorizationStartInput(
	clientId: string,
	pkce: { challenge: string },
	overrides: Partial<Parameters<typeof startAuthorization>[1]> = {},
) {
	return {
		pendingId: null,
		clientId,
		redirectUri: REDIRECT_URI,
		state: "state-123",
		nonce: "nonce-456",
		codeChallenge: pkce.challenge,
		codeChallengeMethod: "S256",
		responseType: "code",
		scope: "openid profile email",
		...overrides,
	};
}

function tokenExchangeRequest() {
	return new Request("https://mail.example.com/api/v1/oauth/token", {
		method: "POST",
	});
}

describe("OIDC authorization service", () => {
	it("rejects authorization when PKCE challenge is missing", async () => {
		await withDb(env, async (db) => {
			const client = await createTestClient(db);
			const result = await startAuthorization(
				db,
				authorizationStartInput(client.clientId, { challenge: "" }, {
					codeChallenge: null,
				}),
				null,
				WEB_ORIGIN,
			);

			expect(result).toEqual({
				kind: "redirect",
				url: `${REDIRECT_URI}?error=invalid_request&error_description=PKCE+with+S256+is+required&state=state-123`,
			});
		});
	}, 20_000);

	it("rejects authorization when PKCE challenge method is not S256", async () => {
		await withDb(env, async (db) => {
			const client = await createTestClient(db);
			const pkce = createPkcePair();
			const result = await startAuthorization(
				db,
				authorizationStartInput(client.clientId, pkce, {
					codeChallengeMethod: "plain",
				}),
				null,
				WEB_ORIGIN,
			);

			expect(result).toEqual({
				kind: "redirect",
				url: `${REDIRECT_URI}?error=invalid_request&error_description=PKCE+with+S256+is+required&state=state-123`,
			});
		});
	}, 20_000);

	it("rejects authorization when openid scope is not granted", async () => {
		await withDb(env, async (db) => {
			const client = await createTestClient(db);
			const pkce = createPkcePair();
			const result = await startAuthorization(
				db,
				authorizationStartInput(client.clientId, pkce, {
					scope: "profile email",
				}),
				null,
				WEB_ORIGIN,
			);

			expect(result).toEqual({
				kind: "redirect",
				url: `${REDIRECT_URI}?error=invalid_scope&error_description=openid+scope+is+required&state=state-123`,
			});
		});
	}, 20_000);

	it("denies authorization for intendant accounts", async () => {
		await withDb(env, async (db) => {
			const client = await createTestClient(db);
			const pkce = createPkcePair();
			const accountId = await createAccount(db, { isIntendant: true });

			const result = await startAuthorization(
				db,
				authorizationStartInput(client.clientId, pkce),
				sessionPrincipal(accountId, { isIntendant: true }),
				WEB_ORIGIN,
			);

			expect(result.kind).toBe("redirect");
			if (result.kind !== "redirect") {
				return;
			}
			const url = new URL(result.url);
			expect(url.searchParams.get("error")).toBe("access_denied");
			expect(url.searchParams.get("error_description")).toBe(
				"Intendant cannot use OIDC",
			);
			expect(url.searchParams.get("state")).toBe("state-123");
		});
	}, 20_000);

	it("redirects unauthenticated users to login", async () => {
		await withDb(env, async (db) => {
			const client = await createTestClient(db);
			const pkce = createPkcePair();

			const result = await startAuthorization(
				db,
				authorizationStartInput(client.clientId, pkce),
				null,
				WEB_ORIGIN,
			);

			expect(result.kind).toBe("redirect");
			if (result.kind !== "redirect") {
				return;
			}
			const url = new URL(result.url);
			expect(url.pathname).toBe("/login");
			expect(url.searchParams.get("return_to")).toMatch(
				/^\/api\/v1\/oauth\/authorize\?pending=/,
			);
		});
	}, 20_000);

	it("completes authorization and returns an authorization code", async () => {
		await withDb(env, async (db) => {
			const client = await createTestClient(db);
			const pkce = createPkcePair();
			const accountId = await createAccount(db);

			const result = await startAuthorization(
				db,
				authorizationStartInput(client.clientId, pkce),
				sessionPrincipal(accountId),
				WEB_ORIGIN,
			);

			expect(result.kind).toBe("redirect");
			if (result.kind !== "redirect") {
				return;
			}
			const url = new URL(result.url);
			expect(url.origin + url.pathname).toBe(REDIRECT_URI);
			expect(url.searchParams.get("code")).toBeTruthy();
			expect(url.searchParams.get("state")).toBe("state-123");
		});
	}, 20_000);

	it("redirects to consent when required and approves on decision", async () => {
		await withDb(env, async (db) => {
			const client = await createTestClient(db, { requireConsent: true });
			const pkce = createPkcePair();
			const accountId = await createAccount(db);

			const startResult = await startAuthorization(
				db,
				authorizationStartInput(client.clientId, pkce),
				sessionPrincipal(accountId),
				WEB_ORIGIN,
			);

			expect(startResult.kind).toBe("redirect");
			if (startResult.kind !== "redirect") {
				return;
			}
			const consentUrl = new URL(startResult.url);
			expect(consentUrl.pathname).toBe("/oauth/consent");
			const pendingId = consentUrl.searchParams.get("pending");
			expect(pendingId).toBeTruthy();

			const approveResult = await decideConsent(db, {
				pendingId: pendingId!,
				decision: "approve",
				accountId,
			});

			const redirectUrl = new URL(approveResult.redirectTo);
			expect(redirectUrl.searchParams.get("code")).toBeTruthy();
			expect(redirectUrl.searchParams.get("state")).toBe("state-123");
		});
	}, 20_000);

	it("denies consent and redirects with access_denied", async () => {
		await withDb(env, async (db) => {
			const client = await createTestClient(db, { requireConsent: true });
			const pkce = createPkcePair();
			const accountId = await createAccount(db);

			const startResult = await startAuthorization(
				db,
				authorizationStartInput(client.clientId, pkce),
				sessionPrincipal(accountId),
				WEB_ORIGIN,
			);

			expect(startResult.kind).toBe("redirect");
			if (startResult.kind !== "redirect") {
				return;
			}
			const pendingId = new URL(startResult.url).searchParams.get("pending");
			expect(pendingId).toBeTruthy();

			const denyResult = await decideConsent(db, {
				pendingId: pendingId!,
				decision: "deny",
				accountId,
			});

			const redirectUrl = new URL(denyResult.redirectTo);
			expect(redirectUrl.searchParams.get("error")).toBe("access_denied");
			expect(redirectUrl.searchParams.get("state")).toBe("state-123");

			const pendingRows = await db
				.select()
				.from(oidcPendingAuthorizations)
				.where(eq(oidcPendingAuthorizations.id, pendingId!));
			expect(pendingRows).toHaveLength(0);
		});
	}, 20_000);

	it("exchanges an authorization code for tokens with valid PKCE", async () => {
		clearOidcSigningKeyCache();
		await withDb(env, async (db) => {
			const client = await createTestClient(db);
			const pkce = createPkcePair();
			const accountId = await createAccount(db);

			const authResult = await startAuthorization(
				db,
				authorizationStartInput(client.clientId, pkce),
				sessionPrincipal(accountId),
				WEB_ORIGIN,
			);

			expect(authResult.kind).toBe("redirect");
			if (authResult.kind !== "redirect") {
				return;
			}
			const code = new URL(authResult.url).searchParams.get("code");
			expect(code).toBeTruthy();

			const tokens = await exchangeAuthorizationCode(
				db,
				env,
				tokenExchangeRequest(),
				{
					code: code!,
					clientId: client.clientId,
					redirectUri: REDIRECT_URI,
					codeVerifier: pkce.verifier,
					clientSecret: client.clientSecret ?? undefined,
				},
			);

			expect(tokens.token_type).toBe("Bearer");
			expect(tokens.access_token).toBeTruthy();
			expect(tokens.refresh_token).toBeTruthy();
			expect(tokens.id_token).toBeTruthy();
			expect(tokens.scope).toContain("openid");
		});
	}, 20_000);

	it("rejects token exchange with an invalid PKCE verifier", async () => {
		clearOidcSigningKeyCache();
		await withDb(env, async (db) => {
			const client = await createTestClient(db);
			const pkce = createPkcePair();
			const accountId = await createAccount(db);

			const authResult = await startAuthorization(
				db,
				authorizationStartInput(client.clientId, pkce),
				sessionPrincipal(accountId),
				WEB_ORIGIN,
			);

			expect(authResult.kind).toBe("redirect");
			if (authResult.kind !== "redirect") {
				return;
			}
			const code = new URL(authResult.url).searchParams.get("code");
			expect(code).toBeTruthy();

			await expect(
				exchangeAuthorizationCode(db, env, tokenExchangeRequest(), {
					code: code!,
					clientId: client.clientId,
					redirectUri: REDIRECT_URI,
					codeVerifier: "wrong-verifier",
					clientSecret: client.clientSecret ?? undefined,
				}),
			).rejects.toBeInstanceOf(OidcError);
		});
	}, 20_000);
});
