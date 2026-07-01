import { describe, expect, it } from "vitest";

import { buildReplyThreading } from "../src/lib/messages/build-reply-threading";

describe("buildReplyThreading", () => {
	it("sets in-reply-to to the parent and appends to references", () => {
		expect(
			buildReplyThreading({
				messageId: "<parent@example.com>",
				references: ["<root@example.com>"],
			}),
		).toEqual({
			inReplyTo: "<parent@example.com>",
			references: ["<root@example.com>", "<parent@example.com>"],
		});
	});

	it("does not duplicate the parent in references", () => {
		expect(
			buildReplyThreading({
				messageId: "<parent@example.com>",
				references: ["<parent@example.com>"],
			}),
		).toEqual({
			inReplyTo: "<parent@example.com>",
			references: ["<parent@example.com>"],
		});
	});
});
