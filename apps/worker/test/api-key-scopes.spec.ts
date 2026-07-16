import { describe, expect, it } from "vitest";

import {
	apiKeyScopesForRoute,
	canPrincipalGrantApiKeyScope,
	normalizeApiKeyScopes,
	parseStoredApiKeyScopes,
	scopeRequiredForRoute,
} from "../src/lib/auth/api-key-scopes";
import type { Principal } from "../src/lib/auth/types";

function basePrincipal(overrides: Partial<Principal> = {}): Principal {
	return {
		kind: "session",
		accountId: "acc-1",
		isIntendant: false,
		role: "user",
		status: "active",
		loginIdentifier: "user@example.com",
		primaryMailboxId: "mb-primary",
		domainIds: [],
		grantMailboxIds: [],
		sharedMailboxAssignment: [],
		...overrides,
	};
}

describe("API key scopes", () => {
	it("normalizes and sorts valid scopes", () => {
		expect(
			normalizeApiKeyScopes(["threads:update", "messages:read", "threads:update"]),
		).toEqual(["messages:read", "threads:update"]);
	});

	it("rejects unknown scopes", () => {
		expect(() => normalizeApiKeyScopes(["made_up:scope"])).toThrow(
			"Unknown API key scope",
		);
	});

	it("maps protected routes to fine-grained scopes", () => {
		expect(scopeRequiredForRoute("GET", "/api/v1/messages/:id")).toBe(
			"messages:read",
		);
		expect(scopeRequiredForRoute("POST", "/api/v1/messages/:id/reply")).toBe(
			"messages:reply",
		);
		expect(scopeRequiredForRoute("PATCH", "/api/v1/accounts/:id/assignments")).toBe(
			"account_assignments:update",
		);
		expect(scopeRequiredForRoute("GET", "/api/v1/auth/me")).toBe("profile:read");
		expect(scopeRequiredForRoute("PATCH", "/api/v1/auth/me")).toBe("profile:update");
	});

	it("uses self profile picture scope for own account picture reads", () => {
		expect(
			apiKeyScopesForRoute("GET", "/api/v1/accounts/:id/profile-picture", {
				principal: basePrincipal({ accountId: "acc-1" }),
				params: { id: "acc-1" },
			}),
		).toEqual(["profile_picture:read"]);
		expect(
			apiKeyScopesForRoute("GET", "/api/v1/accounts/:id/profile-picture", {
				principal: basePrincipal({ accountId: "acc-1", role: "admin" }),
				params: { id: "acc-2" },
			}),
		).toEqual(["account_profile_pictures:read"]);
	});

	it("ignores removed scopes when reading stored keys", () => {
		expect(
			parseStoredApiKeyScopes(["messages:read", "account_sessions:list"]),
		).toEqual(["messages:read"]);
	});

	it("does not expose session-only endpoints to API keys", () => {
		expect(scopeRequiredForRoute("GET", "/api/v1/auth/me")).not.toBeNull();
		expect(scopeRequiredForRoute("POST", "/api/v1/api-keys")).toBeNull();
		expect(scopeRequiredForRoute("GET", "/api/v1/auth/sessions")).toBeNull();
		expect(scopeRequiredForRoute("POST", "/api/v1/auth/recovery-email/send")).toBeNull();
		expect(scopeRequiredForRoute("GET", "/api/v1/auth/passkeys")).toBeNull();
		expect(scopeRequiredForRoute("GET", "/api/v1/accounts/:id/sessions")).toBeNull();
		expect(scopeRequiredForRoute("GET", "/api/v1/accounts/:id/mfa")).toBeNull();
	});

	it("limits user key scopes to what the principal can already do", () => {
		expect(canPrincipalGrantApiKeyScope(basePrincipal(), "messages:read")).toBe(true);
		expect(canPrincipalGrantApiKeyScope(basePrincipal(), "profile:read")).toBe(true);
		expect(canPrincipalGrantApiKeyScope(basePrincipal(), "profile:update")).toBe(true);
		expect(canPrincipalGrantApiKeyScope(basePrincipal(), "accounts:list")).toBe(false);
		expect(
			canPrincipalGrantApiKeyScope(
				basePrincipal({ role: "admin", domainIds: ["dom-1"] }),
				"accounts:list",
			),
		).toBe(true);
		expect(
			canPrincipalGrantApiKeyScope(basePrincipal({ role: "superadmin" }), "oidc_clients:create"),
		).toBe(true);
	});
});
