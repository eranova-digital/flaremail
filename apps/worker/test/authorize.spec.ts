import { describe, expect, it } from "vitest";

import { authorize } from "../src/lib/auth/access";
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

describe("authorize", () => {
	it("allows public routes without checks", () => {
		expect(() =>
			authorize(basePrincipal(), "public"),
		).not.toThrow();
	});

	it("rejects suspended accounts for mail access", () => {
		expect(() =>
			authorize(
				basePrincipal({ status: "suspended" }),
				"mail_read",
				{ mailboxId: "mb-primary" },
			),
		).toThrow("Account is suspended");
	});

	it("requires mail:read scope for OIDC user mail_read", () => {
		expect(() =>
			authorize(
				basePrincipal({
					kind: "oidc_user",
					oidcScopes: ["openid"],
				}),
				"mail_read",
			),
		).toThrow();

		expect(() =>
			authorize(
				basePrincipal({
					kind: "oidc_user",
					oidcScopes: ["mail:read"],
				}),
				"mail_read",
			),
		).not.toThrow();
	});

	it("requires mail:send scope for OIDC user mail_write", () => {
		expect(() =>
			authorize(
				basePrincipal({
					kind: "oidc_user",
					oidcScopes: ["mail:read"],
				}),
				"mail_write",
			),
		).toThrow();

		expect(() =>
			authorize(
				basePrincipal({
					kind: "oidc_user",
					oidcScopes: ["mail:send"],
				}),
				"mail_write",
			),
		).not.toThrow();
	});

	it("allows user access to granted mailbox", () => {
		expect(() =>
			authorize(
				basePrincipal({ grantMailboxIds: ["mb-shared"] }),
				"mail_read",
				{ mailboxId: "mb-shared" },
			),
		).not.toThrow();
	});

	it("denies user access to unrelated mailbox", () => {
		expect(() =>
			authorize(
				basePrincipal(),
				"mail_read",
				{ mailboxId: "mb-other" },
			),
		).toThrow();
	});

	it("allows admin access to domain shared mailbox without explicit grant", () => {
		expect(() =>
			authorize(
				basePrincipal({
					role: "admin",
					domainIds: ["dom-1"],
				}),
				"mail_read",
				{ mailboxId: "mb-shared" },
			),
		).not.toThrow();
	});

	it("allows superadmin access to shared mailbox without explicit grant", () => {
		expect(() =>
			authorize(
				basePrincipal({ role: "superadmin" }),
				"mail_read",
				{ mailboxId: "mb-shared" },
			),
		).not.toThrow();
	});

	it("allows platform principals on domain_admin", () => {
		expect(() =>
			authorize(
				basePrincipal({ role: "superadmin" }),
				"domain_admin",
				{ domainId: "dom-1" },
			),
		).not.toThrow();
	});
});

describe("actionForPath", () => {
	it("maps draft routes to mail_write", async () => {
		const { actionForPath } = await import("../src/lib/auth/actions");
		expect(actionForPath("PATCH", "/api/v1/messages/drafts/abc")).toBe(
			"mail_write",
		);
		expect(actionForPath("GET", "/api/v1/messages/drafts/abc")).toBe(
			"mail_read",
		);
	});
});
