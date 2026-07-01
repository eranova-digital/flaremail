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
			}) as R2ObjectBody,
	} as R2Bucket;
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

	it("includes all participants for replyAll minus self", async () => {
		const result = await resolveReplyRecipients(
			mockBucket(parentEml),
			{
				rawEmlKey: "eml/parent",
				from: "alice@example.com",
				to: "bob@example.com",
				cc: "carol@example.com",
			},
			"bob@example.com",
			true,
		);

		expect(result.to).toEqual(
			expect.arrayContaining([
				"alice@example.com",
				"carol@example.com",
				"support@example.com",
			]),
		);
		expect(result.to).not.toContain("bob@example.com");
	});
});
