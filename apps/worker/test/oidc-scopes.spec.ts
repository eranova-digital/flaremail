import { describe, expect, it } from "vitest";

import {
	intersectScopes,
	parseScopeList,
	scopesCovered,
} from "../src/services/oidc";

describe("OIDC scope helpers", () => {
	it("parses space-delimited scopes with defaults", () => {
		expect(parseScopeList(null)).toEqual(["openid", "profile", "email"]);
		expect(parseScopeList("openid mail:read mail:read")).toEqual([
			"openid",
			"mail:read",
		]);
	});

	it("intersects requested scopes with the client allowlist", () => {
		expect(
			intersectScopes(
				["openid", "mail:send", "admin"],
				["openid", "profile", "mail:read"],
			),
		).toEqual(["openid"]);
	});

	it("checks whether a consent grant covers requested scopes", () => {
		expect(scopesCovered(["openid", "email"], ["openid"])).toBe(true);
		expect(scopesCovered(["openid"], ["openid", "mail:read"])).toBe(false);
	});
});
