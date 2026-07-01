import { describe, expect, it } from "vitest";

import { resolveThreadIdFromLookup } from "../src/lib/resolve-thread-id";

const knownMessages = new Map<string, string>([
	["<root@example.com>", "thread-root"],
	["<parent@example.com>", "thread-parent"],
]);

function lookup(messageId: string): string | null {
	return knownMessages.get(messageId) ?? null;
}

describe("resolveThreadIdFromLookup", () => {
	it("creates a new thread when there are no threading headers", () => {
		expect(
			resolveThreadIdFromLookup(
				{ inReplyTo: null, references: null },
				lookup,
				() => "thread-new",
			),
		).toBe("thread-new");
	});

	it("reuses the parent thread when In-Reply-To is known", () => {
		expect(
			resolveThreadIdFromLookup(
				{
					inReplyTo: "<parent@example.com>",
					references: ["<root@example.com>", "<parent@example.com>"],
				},
				lookup,
				() => "thread-new",
			),
		).toBe("thread-parent");
	});

	it("walks References from newest to oldest when only references are present", () => {
		expect(
			resolveThreadIdFromLookup(
				{
					inReplyTo: null,
					references: ["<root@example.com>", "<unknown@example.com>"],
				},
				lookup,
				() => "thread-new",
			),
		).toBe("thread-root");
	});

	it("falls back to references when In-Reply-To is unknown", () => {
		expect(
			resolveThreadIdFromLookup(
				{
					inReplyTo: "<missing@example.com>",
					references: ["<root@example.com>"],
				},
				lookup,
				() => "thread-new",
			),
		).toBe("thread-root");
	});

	it("creates a new thread when all referenced messages are unknown", () => {
		expect(
			resolveThreadIdFromLookup(
				{
					inReplyTo: "<missing@example.com>",
					references: ["<also-missing@example.com>"],
				},
				lookup,
				() => "thread-new",
			),
		).toBe("thread-new");
	});
});
