import { describe, expect, it } from "vitest";

import {
	buildReplyQuotedText,
	ensureReplyQuoteBody,
} from "./build-reply-quote";

describe("buildReplyQuotedText", () => {
	it("builds a Gmail-style attribution and quotes visible parent text", () => {
		const quoted = buildReplyQuotedText({
			from: "patrick@borcean.ro",
			text: "This is the x email test.",
			sentAt: "2026-07-02T15:14:06.000Z",
		});

		expect(quoted).toMatch(
			/^On Thu, 2 Jul 2026 at \d{2}:\d{2}, <patrick@borcean\.ro> wrote:\n\nThis is the x email test\.$/,
		);
	});

	it("strips nested quotes from the parent before quoting", () => {
		const quoted = buildReplyQuotedText({
			from: "borceanpatrick2004@gmail.com",
			text: `It works!

On Thu, 2 Jul 2026 at 18:14, <patrick@borcean.ro> wrote:

This is the x email test.`,
			receivedAt: "2026-07-02T15:14:19.000Z",
		});

		expect(quoted).toContain("It works!");
		expect(quoted).not.toContain("This is the x email test.");
	});
});

describe("ensureReplyQuoteBody", () => {
	const quote =
		"On Thu, 2 Jul 2026 at 18:14, <patrick@borcean.ro> wrote:\n\nThis is the x email test.";

	it("prepends blank lines before the quote for an empty body", () => {
		expect(ensureReplyQuoteBody("", quote)).toBe(`\n\n${quote}`);
	});

	it("does not duplicate an existing quote block", () => {
		const body = `My reply\n\n${quote}`;
		expect(ensureReplyQuoteBody(body, quote)).toBe(body);
	});
});
