import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/auth/mailbox-access");

import { assertPrincipalCanAccessMailbox } from "../src/lib/auth/mailbox-access";
import type { Principal } from "../src/lib/auth/types";
import {
	resolveIdentityForSend,
	SYSTEM_MAILBOX_FALLBACK_IDENTITY_ID,
} from "../src/services/identities";

const SYSTEM_PRINCIPAL: Principal = {
	kind: "session",
	accountId: null,
	isIntendant: true,
	role: null,
	status: null,
	loginIdentifier: null,
	primaryMailboxId: null,
	domainIds: [],
	grantMailboxIds: [],
	sharedMailboxAssignment: [],
};

function createDbMock(mailbox: {
	id: string;
	type: string;
	personalIdentityAllowance?: boolean;
	identityExport?: boolean;
}) {
	return {
		select: () => ({
			from: () => ({
				where: () => ({
					limit: async () => [mailbox],
					orderBy: async () => [],
				}),
				orderBy: async () => [],
			}),
		}),
	};
}

describe("system mailbox identity fallback", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(assertPrincipalCanAccessMailbox).mockResolvedValue(undefined);
	});

	it("resolves a nameless fallback for blackhole mailboxes with no identities", async () => {
		const db = createDbMock({
			id: "noreply-id",
			type: "blackhole",
		});

		const resolved = await resolveIdentityForSend(
			db as never,
			SYSTEM_PRINCIPAL,
			"noreply-id",
			null,
		);

		expect(resolved.identity.id).toBe(SYSTEM_MAILBOX_FALLBACK_IDENTITY_ID);
		expect(resolved.fromName).toBe("");
		expect(resolved.signatureHtml).toBeNull();
	});

	it("resolves a nameless fallback for system mailboxes with no identities", async () => {
		const db = createDbMock({
			id: "postmaster-id",
			type: "system",
		});

		const resolved = await resolveIdentityForSend(
			db as never,
			SYSTEM_PRINCIPAL,
			"postmaster-id",
			undefined,
		);

		expect(resolved.identity.id).toBe(SYSTEM_MAILBOX_FALLBACK_IDENTITY_ID);
		expect(resolved.fromName).toBe("");
	});
});
