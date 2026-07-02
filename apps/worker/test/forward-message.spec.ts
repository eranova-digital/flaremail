import { describe, expect, it } from "vitest";

import {
	buildForwardBodyText,
	buildForwardQuotedText,
	forwardSubject,
} from "../src/lib/messages/build-forward-content";
import { parseForwardBody } from "../src/lib/messages/outbound-payload";

describe("forwardSubject", () => {
	it("prepends Fwd: to a plain subject", () => {
		expect(forwardSubject("Hello")).toBe("Fwd: Hello");
	});

	it("does not prepend Fwd: when already present", () => {
		expect(forwardSubject("Fwd: Hello")).toBe("Fwd: Hello");
		expect(forwardSubject("FW: Hello")).toBe("FW: Hello");
	});

	it("returns Fwd: for an empty parent subject", () => {
		expect(forwardSubject(null)).toBe("Fwd:");
	});
});

describe("buildForwardQuotedText", () => {
	it("includes forwarded headers and body", () => {
		const quoted = buildForwardQuotedText({
			from: "sender@example.com",
			subject: "Hello",
			text: "Body text",
			sentAt: new Date("2026-01-15T12:00:00.000Z"),
			receivedAt: new Date("2026-01-15T12:00:00.000Z"),
		});

		expect(quoted).toContain("---------- Forwarded message ----------");
		expect(quoted).toContain("From: sender@example.com");
		expect(quoted).toContain("Subject: Hello");
		expect(quoted).toContain("Body text");
	});
});

describe("buildForwardBodyText", () => {
	it("prepends user intro above the quote", () => {
		expect(buildForwardBodyText("Please see below.", "quoted")).toBe(
			"Please see below.\n\nquoted",
		);
	});

	it("returns only the quote when intro is empty", () => {
		expect(buildForwardBodyText(undefined, "quoted")).toBe("quoted");
	});
});

describe("parseForwardBody", () => {
	it("requires mailboxId and to", () => {
		expect(
			parseForwardBody({
				mailboxId: "00000000-0000-0000-0000-000000000001",
				to: ["friend@example.com"],
			}),
		).toMatchObject({
			mailboxId: "00000000-0000-0000-0000-000000000001",
			to: ["friend@example.com"],
			includeAttachments: true,
			includeQuotedBody: true,
		});
	});

	it("allows disabling quoted body and parent attachments", () => {
		expect(
			parseForwardBody({
				mailboxId: "00000000-0000-0000-0000-000000000001",
				to: ["friend@example.com"],
				text: "Already quoted",
				includeAttachments: false,
				includeQuotedBody: false,
			}),
		).toMatchObject({
			includeAttachments: false,
			includeQuotedBody: false,
			text: "Already quoted",
		});
	});
});
