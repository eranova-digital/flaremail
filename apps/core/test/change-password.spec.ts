import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/auth/password");
vi.mock("../src/lib/logs/emit", () => ({
	safeEmitLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../src/services/mfa", () => ({
	isMfaEnabled: vi.fn(),
	verifyAccountTotpCode: vi.fn(),
	getMfaStatus: vi.fn(),
	createMfaChallengeToken: vi.fn(),
}));
vi.mock("../src/services/auth-session", () => ({
	createSession: vi.fn(),
	revokeAllSessions: vi.fn(),
	signOutSession: vi.fn(),
}));

import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import { safeEmitLog } from "../src/lib/logs/emit";
import { changePassword } from "../src/services/auth";
import { revokeAllSessions } from "../src/services/auth-session";
import { isMfaEnabled, verifyAccountTotpCode } from "../src/services/mfa";

const ACCOUNT_ID = "account-1";
const SESSION_ID = "session-1";
const CURRENT = "Current1pass";
const NEXT = "Next1pass";

function accountRow(overrides: {
	isIntendant?: boolean;
	passwordHash?: string | null;
} = {}) {
	return {
		id: ACCOUNT_ID,
		isIntendant: false,
		passwordHash: "hashed-current",
		...overrides,
	};
}

function mockDb(account: ReturnType<typeof accountRow> | null) {
	const where = vi.fn().mockResolvedValue(undefined);
	const set = vi.fn(() => ({ where }));
	return {
		select: () => ({
			from: () => ({
				where: () => ({
					limit: async () => (account ? [account] : []),
				}),
			}),
		}),
		update: vi.fn(() => ({ set })),
		set,
		where,
	};
}

const baseInput = {
	accountId: ACCOUNT_ID,
	currentPassword: CURRENT,
	newPassword: NEXT,
	encryptionKey: "test-encryption-key",
	currentSessionId: SESSION_ID,
};

describe("changePassword", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(verifyPassword).mockResolvedValue(true);
		vi.mocked(hashPassword).mockResolvedValue("hashed-next");
		vi.mocked(isMfaEnabled).mockResolvedValue(false);
		vi.mocked(verifyAccountTotpCode).mockResolvedValue(true);
		vi.mocked(revokeAllSessions).mockResolvedValue({
			signedOutCurrent: false,
			cookieHeader: null,
		});
	});

	it("requires the current session id so other sessions can be revoked safely", async () => {
		const db = mockDb(accountRow());

		await expect(
			changePassword(db as never, { ...baseInput, currentSessionId: "" }),
		).rejects.toThrow("This endpoint requires an authenticated session");
		expect(db.update).not.toHaveBeenCalled();
		expect(revokeAllSessions).not.toHaveBeenCalled();
	});

	it("rejects the intendant", async () => {
		const db = mockDb(accountRow({ isIntendant: true }));

		await expect(changePassword(db as never, baseInput)).rejects.toThrow(
			"The intendant cannot change this password",
		);
		expect(verifyPassword).not.toHaveBeenCalled();
		expect(db.update).not.toHaveBeenCalled();
		expect(revokeAllSessions).not.toHaveBeenCalled();
	});

	it("rejects a wrong current password without revealing the new password outcome", async () => {
		const db = mockDb(accountRow());
		vi.mocked(verifyPassword).mockResolvedValue(false);

		await expect(changePassword(db as never, baseInput)).rejects.toThrow(
			"Invalid password",
		);
		expect(hashPassword).not.toHaveBeenCalled();
		expect(db.update).not.toHaveBeenCalled();
		expect(revokeAllSessions).not.toHaveBeenCalled();
		expect(safeEmitLog).toHaveBeenCalledWith(
			db,
			expect.objectContaining({
				summary: "{actor} failed to change their password",
				actorAccountId: ACCOUNT_ID,
			}),
		);
	});

	it("requires TOTP when MFA is enabled", async () => {
		const db = mockDb(accountRow());
		vi.mocked(isMfaEnabled).mockResolvedValue(true);

		await expect(changePassword(db as never, baseInput)).rejects.toThrow(
			"Authenticator code is required",
		);
		expect(db.update).not.toHaveBeenCalled();
	});

	it("rejects an invalid TOTP code", async () => {
		const db = mockDb(accountRow());
		vi.mocked(isMfaEnabled).mockResolvedValue(true);
		vi.mocked(verifyAccountTotpCode).mockResolvedValue(false);

		await expect(
			changePassword(db as never, { ...baseInput, code: "000000" }),
		).rejects.toThrow("Invalid authentication code");
		expect(db.update).not.toHaveBeenCalled();
		expect(safeEmitLog).toHaveBeenCalledWith(
			db,
			expect.objectContaining({
				summary: "{actor} failed to change their password",
			}),
		);
	});

	it("rejects a new password that equals the current password", async () => {
		const db = mockDb(accountRow());

		await expect(
			changePassword(db as never, { ...baseInput, newPassword: CURRENT }),
		).rejects.toThrow(
			"New password must be different from the current password",
		);
		expect(db.update).not.toHaveBeenCalled();
		expect(revokeAllSessions).not.toHaveBeenCalled();
	});

	it("rejects a weak new password", async () => {
		const db = mockDb(accountRow());

		await expect(
			changePassword(db as never, { ...baseInput, newPassword: "short" }),
		).rejects.toThrow(
			"Password must be at least 8 characters and include a letter and a number",
		);
		expect(db.update).not.toHaveBeenCalled();
	});

	it("updates the hash, keeps the current session, and revokes others", async () => {
		const db = mockDb(accountRow());

		await changePassword(db as never, { ...baseInput, code: "123456" });

		expect(hashPassword).toHaveBeenCalledWith(NEXT);
		expect(db.set).toHaveBeenCalledWith(
			expect.objectContaining({ passwordHash: "hashed-next" }),
		);
		expect(revokeAllSessions).toHaveBeenCalledWith(db, ACCOUNT_ID, {
			includeCurrent: false,
			currentSessionId: SESSION_ID,
		});
		expect(safeEmitLog).toHaveBeenCalledWith(
			db,
			expect.objectContaining({
				importance: 3,
				summary: "{actor} changed their password",
				actorAccountId: ACCOUNT_ID,
			}),
		);
	});

	it("verifies TOTP when MFA is enabled and then rotates the password", async () => {
		const db = mockDb(accountRow());
		vi.mocked(isMfaEnabled).mockResolvedValue(true);

		await changePassword(db as never, { ...baseInput, code: "847291" });

		expect(verifyAccountTotpCode).toHaveBeenCalledWith(db, {
			accountId: ACCOUNT_ID,
			code: "847291",
			encryptionKey: "test-encryption-key",
		});
		expect(db.update).toHaveBeenCalled();
	});
});
