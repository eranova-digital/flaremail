import { describe, expect, it } from "vitest";

import { isUniqueViolation } from "../src/lib/db/postgres-error";
import {
	headerValuesForMessageVisibility,
	sendRelinkMailboxIds,
} from "../src/lib/thread-mailbox";

describe("isUniqueViolation", () => {
	it("detects postgres unique violation codes", () => {
		expect(isUniqueViolation({ code: "23505" })).toBe(true);
	});

	it("detects unique constraint names in error messages", () => {
		expect(
			isUniqueViolation({
				message:
					'duplicate key value violates unique constraint "messages_message_id_unique"',
			}),
		).toBe(true);
	});

	it("returns false for unrelated errors", () => {
		expect(isUniqueViolation(new Error("something else"))).toBe(false);
	});
});

describe("sendRelinkMailboxIds", () => {
	it("always includes the sending mailbox", () => {
		expect(
			sendRelinkMailboxIds(["recipient-mailbox-id"], "sender-mailbox-id"),
		).toEqual(["recipient-mailbox-id", "sender-mailbox-id"]);
	});

	it("deduplicates when the sender is already resolved", () => {
		expect(
			sendRelinkMailboxIds(
				["sender-mailbox-id", "recipient-mailbox-id"],
				"sender-mailbox-id",
			),
		).toEqual(["sender-mailbox-id", "recipient-mailbox-id"]);
	});
});

describe("headerValuesForMessageVisibility", () => {
	it("omits sender headers for inbound messages", () => {
		expect(
			headerValuesForMessageVisibility({
				direction: "inbound",
				from: "sender@example.com",
				to: "recipient@example.com",
				cc: null,
				bcc: null,
				sendStatus: null,
			}),
		).toEqual(["recipient@example.com", null, null]);
	});

	it("includes sender headers for outbound messages", () => {
		expect(
			headerValuesForMessageVisibility({
				direction: "outbound",
				from: "sender@example.com",
				to: "recipient@example.com",
				cc: "cc@example.com",
				bcc: null,
				sendStatus: "sent",
			}),
		).toEqual([
			"sender@example.com",
			"recipient@example.com",
			"cc@example.com",
			null,
		]);
	});

	it("returns no header values for drafts", () => {
		expect(
			headerValuesForMessageVisibility({
				direction: "outbound",
				from: "sender@example.com",
				to: "recipient@example.com",
				cc: null,
				bcc: null,
				sendStatus: "draft",
			}),
		).toEqual([]);
	});
});
