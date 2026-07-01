import { describe, expect, it } from "vitest";

import type { messages } from "../src/db/schema";
import { draftSendPromoteFromDrafts } from "../src/lib/messages/complete-draft-send";

describe("draftSendPromoteFromDrafts", () => {
	const draft = {
		id: "draft-id",
		threadId: "thread-a",
	} as typeof messages.$inferSelect;

	it("promotes when the draft row was updated in place", () => {
		expect(
			draftSendPromoteFromDrafts(draft, {
				...draft,
				id: "draft-id",
				threadId: "thread-a",
			}),
		).toBe(true);
	});

	it("does not promote when the draft was absorbed into an inbound copy", () => {
		expect(
			draftSendPromoteFromDrafts(draft, {
				...draft,
				id: "inbound-id",
				threadId: "thread-a",
			}),
		).toBe(false);
	});
});
