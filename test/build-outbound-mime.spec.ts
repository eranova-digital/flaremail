import { describe, expect, it } from "vitest";

import { buildEmailSendPayload, buildOutboundMimeContent } from "../src/lib/messages/build-outbound-mime";

describe("buildOutboundMimeContent", () => {
	it("includes threading headers for replies", () => {
		const content = buildOutboundMimeContent({
			from: "patrick@eranova.ro",
			payload: {
				to: ["recipient@example.com"],
				subject: "Re: Hello",
				text: "Reply body",
			},
			rfcMessageId: "<outbound@eranova.ro>",
			inReplyTo: "<parent@example.com>",
			references: ["<root@example.com>", "<parent@example.com>"],
		});

		expect(content.headers).toEqual(
			expect.arrayContaining([
				{ key: "Message-ID", value: "<outbound@eranova.ro>" },
				{ key: "In-Reply-To", value: "<parent@example.com>" },
				{
					key: "References",
					value: "<root@example.com> <parent@example.com>",
				},
			]),
		);
	});
});

describe("buildEmailSendPayload", () => {
	it("maps outbound content to the email send builder", () => {
		const payload = buildEmailSendPayload({
			from: "patrick@eranova.ro",
			payload: {
				to: ["recipient@example.com"],
				subject: "Hello",
				text: "Body",
				html: "<p>Body</p>",
			},
		});

		expect(payload.from).toBe("patrick@eranova.ro");
		expect(payload.to).toBe("recipient@example.com");
		expect(payload.headers?.["Message-ID"]).toBeUndefined();
	});

	it("never includes Message-ID and keeps threading headers for replies", () => {
		const payload = buildEmailSendPayload({
			from: "patrick@eranova.ro",
			payload: {
				to: ["recipient@example.com"],
				subject: "Re: Hello",
				text: "Reply body",
			},
			inReplyTo: "<parent@example.com>",
			references: ["<root@example.com>", "<parent@example.com>"],
		});

		expect(payload.headers?.["Message-ID"]).toBeUndefined();
		expect(payload.headers?.["In-Reply-To"]).toBe("<parent@example.com>");
		expect(payload.headers?.References).toBe(
			"<root@example.com> <parent@example.com>",
		);
	});
});
