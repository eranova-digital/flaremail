import { describe, expect, it } from "vitest";

import { collectThreadParties } from "../src/lib/thread-participants";

describe("collectThreadParties", () => {
	it("returns latest sender and external participants excluding the mailbox", () => {
		const result = collectThreadParties(
			[
				{
					from: "patrick@borcean.ro",
					to: "denis@xyz.com",
					cc: null,
					receivedAt: new Date("2026-07-01T10:00:00Z"),
				},
				{
					from: "denis@xyz.com",
					to: "patrick@borcean.ro",
					cc: null,
					receivedAt: new Date("2026-07-01T11:00:00Z"),
				},
			],
			"patrick@borcean.ro",
		);

		expect(result.sender).toBe("denis@xyz.com");
		expect(result.participants).toEqual(["denis@xyz.com"]);
	});

	it("deduplicates participants across messages", () => {
		const result = collectThreadParties(
			[
				{
					from: "patrick@borcean.ro",
					to: "a@example.com, b@example.com",
					cc: "a@example.com",
					receivedAt: new Date("2026-07-01T10:00:00Z"),
				},
			],
			"patrick@borcean.ro",
		);

		expect(result.participants).toEqual(["a@example.com", "b@example.com"]);
	});
});
