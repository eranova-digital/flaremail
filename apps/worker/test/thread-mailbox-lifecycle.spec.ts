import { describe, expect, it } from "vitest";

import {
	folderAfterInboundMessage,
	folderForNonDraftThread,
	reconcileThreadFolderFromMessages,
	sendRelinkMailboxIds,
} from "../src/lib/thread-mailbox";

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
