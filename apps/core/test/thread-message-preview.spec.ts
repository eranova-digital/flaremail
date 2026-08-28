import { describe, expect, it } from "vitest";

import {
	buildRfcMessageIdToUuidMap,
	resolveInReplyToMessageUuid,
	toThreadMessagePreview,
} from "../src/services/threads/dto";
import type { Message } from "../src/db/schema";

function message(overrides: Partial<Message> & Pick<Message, "id" | "messageId">): Message {
	return {
		threadId: "thread-1",
		direction: "inbound",
		sendStatus: null,
		inReplyTo: overrides.inReplyTo ?? null,
		references: null,
		from: "sender@example.com",
		to: "recipient@example.com",
		envelopeTo: "recipient@example.com",
		actualMailboxId: "mailbox-1",
		matchedMailboxId: "mailbox-1",
		matchedVia: "exact",
		cc: null,
		bcc: null,
		subject: "Hello",
		textBody: "Body",
		preview: "Body",
		hasHtml: false,
		hasAttachments: false,
		sentAt: null,
		receivedAt: new Date("2026-01-01T00:00:00.000Z"),
		rawEmlKey: "raw/1",
		sendErrorCode: null,
		sendErrorMessage: null,
		sentByAccountId: null,
		dmarcResult: null,
		bimiDomain: null,
		...overrides,
	};
}

describe("thread message inReplyTo resolution", () => {
	const threadMessages = [
		message({ id: "uuid-root", messageId: "<root@example.com>" }),
		message({
			id: "uuid-parent",
			messageId: "<parent@example.com>",
			inReplyTo: "<root@example.com>",
		}),
		message({
			id: "uuid-branch",
			messageId: "<branch@example.com>",
			inReplyTo: "<root@example.com>",
		}),
	];

	const rfcMap = buildRfcMessageIdToUuidMap(threadMessages);

	it("maps an in-reply-to rfc message id to the parent uuid", () => {
		expect(resolveInReplyToMessageUuid("<root@example.com>", rfcMap)).toBe(
			"uuid-root",
		);
	});

	it("returns null when the parent is not in the thread", () => {
		expect(resolveInReplyToMessageUuid("<missing@example.com>", rfcMap)).toBeNull();
	});

	it("includes inReplyTo on thread message previews", () => {
		expect(
			toThreadMessagePreview(
				threadMessages[1]!,
				resolveInReplyToMessageUuid(threadMessages[1]!.inReplyTo, rfcMap),
			),
		).toMatchObject({
			id: "uuid-parent",
			inReplyTo: "uuid-root",
		});
	});

	it("omits threadId from thread message previews", () => {
		expect(
			toThreadMessagePreview(threadMessages[0]!, null),
		).not.toHaveProperty("threadId");
	});
});
