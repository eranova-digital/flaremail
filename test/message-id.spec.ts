import { describe, expect, it } from "vitest";

import {
	canonicalizeSentMessageId,
	generateMessageId,
} from "../src/lib/messages/message-id";

describe("canonicalizeSentMessageId", () => {
	it("normalizes whitespace in Cloudflare message ids", () => {
		expect(canonicalizeSentMessageId("  <cf@example.com>  ")).toBe(
			"<cf@example.com>",
		);
	});

	it("throws when Cloudflare returns an empty message id", () => {
		expect(() => canonicalizeSentMessageId("   ")).toThrow(
			"Cloudflare returned an empty message id",
		);
	});
});

describe("generateMessageId", () => {
	it("builds a domain-scoped draft placeholder id", () => {
		expect(generateMessageId("Example.COM")).toMatch(
			/^<[0-9a-f-]{36}@example\.com>$/,
		);
	});
});
