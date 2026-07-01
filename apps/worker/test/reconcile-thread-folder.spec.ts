import { describe, expect, it } from "vitest";

import {
	folderForNonDraftThread,
	reconcileThreadFolderFromMessages,
} from "../src/lib/message-mailboxes";

describe("folderForNonDraftThread", () => {
	it("uses inbox when any non-draft message is inbound", () => {
		expect(
			folderForNonDraftThread([
				{ sendStatus: "sent", direction: "outbound" },
				{ sendStatus: null, direction: "inbound" },
			]),
		).toBe("inbox");
	});

	it("uses sent when all non-draft messages are outbound", () => {
		expect(
			folderForNonDraftThread([
				{ sendStatus: "sent", direction: "outbound" },
			]),
		).toBe("sent");
	});
});

describe("reconcileThreadFolderFromMessages", () => {
	it("moves draft-only threads into drafts", () => {
		expect(
			reconcileThreadFolderFromMessages("inbox", [
				{ sendStatus: "draft", direction: "outbound" },
			]),
		).toBe("drafts");
	});

	it("keeps draft-only threads in drafts", () => {
		expect(
			reconcileThreadFolderFromMessages("drafts", [
				{ sendStatus: "draft", direction: "outbound" },
			]),
		).toBeUndefined();
	});

	it("moves mixed threads out of drafts into inbox", () => {
		expect(
			reconcileThreadFolderFromMessages("drafts", [
				{ sendStatus: "draft", direction: "outbound" },
				{ sendStatus: "sent", direction: "outbound" },
				{ sendStatus: null, direction: "inbound" },
			]),
		).toBe("inbox");
	});

	it("leaves mixed threads in inbox unchanged", () => {
		expect(
			reconcileThreadFolderFromMessages("inbox", [
				{ sendStatus: "draft", direction: "outbound" },
				{ sendStatus: null, direction: "inbound" },
			]),
		).toBeUndefined();
	});

	it("does not change trash threads", () => {
		expect(
			reconcileThreadFolderFromMessages("trash", [
				{ sendStatus: "draft", direction: "outbound" },
			]),
		).toBeUndefined();
	});
});
