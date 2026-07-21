import { SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";

import { safeEmitLog } from "../src/lib/logs/emit";
import { recordFailedMfaSignInAttempt } from "../src/services/mfa";

vi.mock("../src/lib/logs/emit", () => ({
	safeEmitLog: vi.fn().mockResolvedValue(undefined),
}));

describe("MFA sign-in attribution", () => {
	it("logs without actor when the MFA token is invalid", async () => {
		const db = {} as Parameters<typeof recordFailedMfaSignInAttempt>[0];

		await recordFailedMfaSignInAttempt(db, {
			mfaToken: "not-a-valid-token",
			encryptionKey: "test-encryption-key",
			logContext: null,
		});

		expect(safeEmitLog).toHaveBeenCalledWith(db, {
			importance: 2,
			type: "auth",
			summary: "Failed sign-in attempt",
			context: null,
		});
	});

	it("looks up the account before attributing a failed sign-in", async () => {
		const encryptionKey = "test-encryption-key-with-enough-length";
		const accountId = crypto.randomUUID();
		const token = await new SignJWT({ accountId, typ: "mfa_challenge" })
			.setProtectedHeader({ alg: "HS256" })
			.setIssuedAt()
			.setExpirationTime(Math.floor(Date.now() / 1000) + 300)
			.sign(new TextEncoder().encode(encryptionKey));

		const selectChain = {
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			limit: vi.fn().mockResolvedValue([{ isIntendant: false }]),
		};
		const db = {
			select: vi.fn().mockReturnValue(selectChain),
		} as unknown as Parameters<typeof recordFailedMfaSignInAttempt>[0];

		await recordFailedMfaSignInAttempt(db, {
			mfaToken: token,
			encryptionKey,
			logContext: null,
		});

		expect(db.select).toHaveBeenCalled();
		expect(safeEmitLog).toHaveBeenCalledWith(db, {
			importance: 2,
			type: "auth",
			summary: "{actor} failed to sign in",
			refs: { actor: { kind: "account", id: accountId } },
			actorAccountId: accountId,
			context: null,
		});
	});
});
