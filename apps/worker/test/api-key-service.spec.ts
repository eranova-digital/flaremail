import { describe, expect, it } from "vitest";

import type { Principal } from "../src/lib/auth/types";
import { assertRequestedApiKeyScopesAllowed } from "../src/services/api-keys";

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

describe("API key service", () => {
	it("rejects scopes the principal cannot grant", () => {
		const principal = basePrincipal({ role: "user" });
		expect(() =>
			assertRequestedApiKeyScopesAllowed(principal, ["account_assignments:update"]),
		).toThrow("You cannot grant API key scope 'account_assignments:update'");
	});

	it("allows scopes matching the principal role", () => {
		const principal = basePrincipal({ role: "admin" });
		expect(() =>
			assertRequestedApiKeyScopesAllowed(principal, ["messages:read"]),
		).not.toThrow();
	});
});
