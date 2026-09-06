import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/auth/transactional-email");
vi.mock("../src/lib/auth/password");
vi.mock("../src/lib/auth/crypto", () => ({
	formatCode: () => "ABCDEF",
}));

import { hashSecret } from "../src/lib/auth/password";
import {
	resolveAccountSenderDomain,
	sendRecoveryVerifyTransactionalEmail,
} from "../src/lib/auth/transactional-email";
import {
	sendRecoveryEmailSetupCode,
	verifyAndSetRecoveryEmail,
} from "../src/services/recovery-email";

describe("recovery email uniqueness", () => {
	const deps = {
		email: { send: vi.fn() } as unknown as SendEmail,
		bucket: {} as R2Bucket,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(hashSecret).mockResolvedValue("hash");
		vi.mocked(resolveAccountSenderDomain).mockResolvedValue("example.com");
		vi.mocked(sendRecoveryVerifyTransactionalEmail).mockResolvedValue();
	});

	function dbWithRecoveryTaken() {
		let selectCalls = 0;
		return {
			select: () => ({
				from: () => ({
					where: () => ({
						limit: async () => {
							selectCalls += 1;
							if (selectCalls === 3) {
								return [{ accountId: "other-account" }];
							}
							return [];
						},
					}),
				}),
			}),
			insert: vi.fn(),
			update: vi.fn(),
		};
	}

	it("rejects setup when the recovery email belongs to another account", async () => {
		const db = dbWithRecoveryTaken();

		await expect(
			sendRecoveryEmailSetupCode(db as never, deps, {
				accountId: "account-1",
				recoveryAddress: "shared@example.org",
			}),
		).rejects.toThrow(
			"This recovery email is already in use by another account",
		);
		expect(db.insert).not.toHaveBeenCalled();
		expect(sendRecoveryVerifyTransactionalEmail).not.toHaveBeenCalled();
	});

	it("allows setup when the address is free", async () => {
		const insertValues = vi.fn().mockResolvedValue(undefined);
		const db = {
			select: () => ({
				from: () => ({
					where: () => ({
						limit: async () => [],
					}),
				}),
			}),
			insert: vi.fn(() => ({ values: insertValues })),
		};

		await sendRecoveryEmailSetupCode(db as never, deps, {
			accountId: "account-1",
			recoveryAddress: "me@example.org",
		});

		expect(insertValues).toHaveBeenCalled();
		expect(sendRecoveryVerifyTransactionalEmail).toHaveBeenCalled();
	});

	it("rejects verify when the recovery email belongs to another account", async () => {
		const db = dbWithRecoveryTaken();

		await expect(
			verifyAndSetRecoveryEmail(db as never, {
				accountId: "account-1",
				recoveryAddress: "shared@example.org",
				code: "ABCDEF",
			}),
		).rejects.toThrow(
			"This recovery email is already in use by another account",
		);
		expect(db.update).not.toHaveBeenCalled();
	});
});
