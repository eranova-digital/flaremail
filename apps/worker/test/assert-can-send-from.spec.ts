import { describe, expect, it } from "vitest";

import { assertCanSendFrom } from "../src/lib/authorize-mailbox";

describe("assertCanSendFrom", () => {
	it("rejects alias mailboxes", async () => {
		const db = {
			select: () => ({
				from: () => ({
					where: () => ({
						limit: async () => [{ type: "alias", isActive: true }],
					}),
				}),
			}),
		};

		await expect(
			assertCanSendFrom(db as never, "mailbox-id"),
		).rejects.toThrow("Alias mailboxes cannot send mail");
	});

	it("allows active receiving mailboxes", async () => {
		const db = {
			select: () => ({
				from: () => ({
					where: () => ({
						limit: async () => [{ type: "primary", isActive: true }],
					}),
				}),
			}),
		};

		await expect(
			assertCanSendFrom(db as never, "mailbox-id"),
		).resolves.toBeUndefined();
	});
});
