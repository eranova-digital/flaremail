import { describe, expect, it } from "vitest";

import { folderAfterInboundMessage } from "../src/lib/thread-mailbox";

describe("folderAfterInboundMessage", () => {
	it("moves sent threads to inbox on inbound activity", () => {
		expect(folderAfterInboundMessage("sent", "inbox")).toBe("inbox");
	});

	it("leaves inbox threads in inbox", () => {
		expect(folderAfterInboundMessage("inbox", "inbox")).toBeUndefined();
	});

	it("does not move archived, trash, or spam threads", () => {
		expect(folderAfterInboundMessage("archived", "inbox")).toBeUndefined();
		expect(folderAfterInboundMessage("trash", "inbox")).toBeUndefined();
		expect(folderAfterInboundMessage("spam", "inbox")).toBeUndefined();
	});

	it("does not move sent threads on outbound touch", () => {
		expect(folderAfterInboundMessage("sent", "sent")).toBeUndefined();
	});
});
