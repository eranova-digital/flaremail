import { describe, expect, it } from "vitest";

import { resolveReplyRecipients } from "../src/lib/messages/resolve-reply-recipients";

const parentEml = [
	"From: Alice <alice@example.com>",
	"To: Bob <bob@example.com>",
	"Cc: Carol <carol@example.com>",
	"Reply-To: Support <support@example.com>",
	"Subject: Question",
	"Message-ID: <parent@example.com>",
	"Content-Type: text/plain; charset=utf-8",
	"",
	"Hello",
].join("\r\n");

function mockBucket(body: string): R2Bucket {
	return {
		get: async () =>
			({
				arrayBuffer: async () => new TextEncoder().encode(body).buffer,
			}) as unknown as R2ObjectBody,
	} as unknown as R2Bucket;
}

describe("resolveReplyRecipients", () => {
	it("uses Reply-To for a normal reply", async () => {
		const result = await resolveReplyRecipients(
			mockBucket(parentEml),
			{
				rawEmlKey: "eml/parent",
				from: "alice@example.com",
				to: "bob@example.com",
				cc: "carol@example.com",
			},
			"bob@example.com",
			false,
		);

		expect(result.to).toEqual(["support@example.com"]);
	});

	it("replies to the original recipients when replying to your own sent mail", async () => {
		const ownEml = [
			"From: Me <me@example.com>",
			"To: Bob <bob@example.com>",
			"Cc: Carol <carol@example.com>",
			"Subject: Question",
			"Message-ID: <own@example.com>",
			"Content-Type: text/plain; charset=utf-8",
			"",
			"Hello",
		].join("\r\n");

		const result = await resolveReplyRecipients(
			mockBucket(ownEml),
			{
				rawEmlKey: "eml/own",
				from: "me@example.com",
				to: "bob@example.com",
				cc: "carol@example.com",
			},
			// Replying to a message we sent: the reply must not loop back to us,
			// it should go to the original recipient.
			"me@example.com",
			false,
		);

		expect(result.to).toEqual(["bob@example.com"]);
	});

	it("keeps original To in To and moves sender/Cc to Cc for replyAll", async () => {
		const result = await resolveReplyRecipients(
			mockBucket(parentEml),
			{
				rawEmlKey: "eml/parent",
				from: "alice@example.com",
				to: "bob@example.com",
				cc: "carol@example.com",
			},
			// Carol replies-all: Bob (original To) stays primary, Alice/Support
			// (sender + Reply-To) and no self move into Cc.
			"carol@example.com",
			true,
		);

		expect(result.to).toEqual(["bob@example.com"]);
		expect(result.cc).toEqual(
			expect.arrayContaining(["alice@example.com", "support@example.com"]),
		);
		expect(result.cc).not.toContain("carol@example.com");
		expect(result.cc).not.toContain("bob@example.com");
	});

	it("falls back to the reply target in To when replyAll has no other To", async () => {
		const result = await resolveReplyRecipients(
			mockBucket(parentEml),
			{
				rawEmlKey: "eml/parent",
				from: "alice@example.com",
				to: "bob@example.com",
				cc: "carol@example.com",
			},
			// Bob replies-all: original To was only Bob (self), so the reply
			// target (Reply-To) becomes primary and Carol stays in Cc.
			"bob@example.com",
			true,
		);

		expect(result.to).toEqual(["support@example.com"]);
		expect(result.cc).toEqual(
			expect.arrayContaining(["alice@example.com", "carol@example.com"]),
		);
		expect(result.cc).not.toContain("bob@example.com");
	});
});
