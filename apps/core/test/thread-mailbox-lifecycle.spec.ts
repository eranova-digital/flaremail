import { describe, expect, it } from "vitest";

import {
	folderAfterInboundMessage,
	folderForNonDraftThread,
	reconcileThreadFolderFromMessages,
	sendRelinkMailboxIds,
} from "../src/lib/thread-mailbox";
import type {
	DraftDeletedEvent,
	DraftUpdatedEvent,
	MessagePersistedEvent,
	OutboundSentEvent,
} from "../src/lib/thread-mailbox";

describe("thread-mailbox lifecycle events", () => {
	it("types MessagePersistedEvent with thread, message, and touch", () => {
		const event: MessagePersistedEvent = {
			threadId: "thread-1",
			messageId: "msg-1",
			touch: {
				subject: "Hello",
				preview: "Hi",
				lastMessageAt: new Date(),
				actualMailboxId: "mb-1",
				folder: "inbox",
				markUnread: true,
			},
		};
		expect(event.touch.folder).toBe("inbox");
	});

	it("types OutboundSentEvent with optional promoteFromDrafts", () => {
		const event: OutboundSentEvent = {
			threadId: "thread-1",
			touch: {
				subject: "Re: Hello",
				preview: "Reply",
				lastMessageAt: new Date(),
				actualMailboxId: "mb-1",
				promoteFromDrafts: true,
			},
		};
		expect(event.touch.promoteFromDrafts).toBe(true);
	});

	it("types DraftUpdatedEvent and DraftDeletedEvent", () => {
		const updated: DraftUpdatedEvent = {
			threadId: "thread-1",
			mailboxId: "mb-1",
			touch: { subject: "Draft", preview: null, lastMessageAt: new Date() },
		};
		const deleted: DraftDeletedEvent = { threadId: "thread-1" };
		expect(updated.mailboxId).toBe("mb-1");
		expect(deleted.threadId).toBe("thread-1");
	});
});

describe("thread-mailbox lifecycle (pure)", () => {
	it("promotes sent thread to inbox on inbound", () => {
		expect(folderAfterInboundMessage("sent", "inbox")).toBe("inbox");
		expect(folderAfterInboundMessage("inbox", "inbox")).toBeUndefined();
	});

	it("reconciles drafts folder when only drafts remain", () => {
		expect(
			reconcileThreadFolderFromMessages("inbox", [
				{ sendStatus: "draft", direction: "outbound" },
			]),
		).toBe("drafts");
	});

	it("promotes drafts folder to sent when non-draft outbound exists", () => {
		expect(
			reconcileThreadFolderFromMessages("drafts", [
				{ sendStatus: "sent", direction: "outbound" },
			]),
		).toBe("sent");
	});

	it("classifies non-draft thread with inbound as inbox", () => {
		expect(
			folderForNonDraftThread([
				{ sendStatus: "sent", direction: "outbound" },
				{ sendStatus: null, direction: "inbound" },
			]),
		).toBe("inbox");
	});

	it("deduplicates sender in send relink mailbox ids", () => {
		expect(sendRelinkMailboxIds(["a", "b"], "a")).toEqual(["a", "b"]);
	});
});
