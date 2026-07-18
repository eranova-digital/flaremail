import { describe, expect, it } from "vitest";

import {
	canPrincipalGrantApiKeyScope,
	normalizeApiKeyScopes,
	parseStoredApiKeyScopes,
} from "../src/lib/auth/api-key-scopes";
import type { Principal } from "../src/lib/auth/types";
import { resolveRouteScopes } from "../src/lib/http/router";
import { authRoutes } from "../src/routes/auth";
import { v1Routes } from "../src/routes/v1";

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

	it("declares scopes on the route registry for protected mail routes", () => {
		const message = v1Routes.find(
			(route) => route.method === "GET" && route.path === "/api/v1/messages/:id",
		);
		const reply = v1Routes.find(
			(route) =>
				route.method === "POST" && route.path === "/api/v1/messages/:id/reply",
		);
		const assignments = authRoutes.find(
			(route) =>
				route.method === "PATCH" &&
				route.path === "/api/v1/accounts/:id/assignments",
		);
		expect(message?.scopes).toEqual(["messages:read"]);
		expect(reply?.scopes).toEqual(["messages:reply"]);
		expect(assignments?.scopes).toEqual(["account_assignments:update"]);
	});

	it("allows public profile picture reads without API key scopes", () => {
		const route = authRoutes.find(
			(entry) =>
				entry.method === "GET" &&
				entry.path === "/api/v1/accounts/:id/profile-picture",
		);
		expect(route?.auth).toBe(false);
		expect(route?.scopes).toBeUndefined();
	});

	it("ignores removed scopes when reading stored keys", () => {
		expect(
			parseStoredApiKeyScopes(["messages:read", "account_sessions:list"]),
		).toEqual(["messages:read"]);
	});

	it("keeps session-only endpoints without API key scopes", () => {
		const apiKeys = authRoutes.find(
			(route) => route.method === "POST" && route.path === "/api/v1/api-keys",
		);
		const sessions = authRoutes.find(
			(route) => route.method === "GET" && route.path === "/api/v1/auth/sessions",
		);
		const me = authRoutes.find(
			(route) => route.method === "GET" && route.path === "/api/v1/auth/me",
		);
		expect(apiKeys?.scopes).toBeUndefined();
		expect(sessions?.scopes).toBeUndefined();
		expect(me?.scopes).toEqual(["profile:read"]);
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
