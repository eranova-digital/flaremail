import { describe, expect, it } from "vitest";

import { buildStrippedEml } from "../src/lib/build-stripped-eml";
import { postalEmailToMimeContent } from "../src/lib/messages/postal-to-mime-content";

const RAW_WITH_ATTACHMENT = [
	"From: sender@example.com",
	"To: recipient@example.com",
	"Subject: With attachment",
	"Message-ID: <msg-with-attachment@example.com>",
	'MIME-Version: 1.0',
	'Content-Type: multipart/mixed; boundary="abc"',
	"",
	"--abc",
	"Content-Type: text/plain; charset=utf-8",
	"",
	"Hello body",
	"--abc",
	'Content-Type: application/pdf; name="report.pdf"',
	"Content-Transfer-Encoding: base64",
	'Content-Disposition: attachment; filename="report.pdf"',
	"",
	"UEsDBBQAAAAIAA==",
	"--abc--",
].join("\r\n");

describe("buildStrippedEml", () => {
	it("keeps message bodies but omits attachment payload markers", async () => {
		const PostalMime = (await import("postal-mime")).default;
		const parsed = await PostalMime.parse(RAW_WITH_ATTACHMENT);
		const storageKey =
			"attachments/550e8400-e29b-41d4-a716-446655440000/660e8400-e29b-41d4-a716-446655440001/report.pdf";
		const stripped = new TextDecoder().decode(
			buildStrippedEml(postalEmailToMimeContent(parsed), [storageKey]),
		);

		expect(stripped).toContain("Hello body");
		expect(stripped).toContain(`X-Attachment-External: ${storageKey}`);
		expect(stripped).not.toContain("application/pdf");
		expect(stripped).not.toContain("UEsDBBQAAAAIAA==");
	});
});
