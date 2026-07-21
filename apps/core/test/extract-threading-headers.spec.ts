import { describe, expect, it } from "vitest";

import { extractThreadingHeaders } from "../src/lib/threading-headers";

describe("extractThreadingHeaders", () => {
	it("prefers worker headers over parsed MIME fields", () => {
		const parsed = {
			headers: [],
			headerLines: [],
			attachments: [],
			inReplyTo: "<parsed-parent@example.com>",
			references: "<parsed-root@example.com>",
			messageId: "<parsed-self@example.com>",
		};
		const headers = new Headers({
			"In-Reply-To": "<worker-parent@example.com>",
			References: "<worker-root@example.com> <worker-parent@example.com>",
			"Message-ID": "<worker-self@example.com>",
		});

		expect(extractThreadingHeaders(headers, parsed)).toEqual({
			inReplyTo: "<worker-parent@example.com>",
			references: [
				"<worker-root@example.com>",
				"<worker-parent@example.com>",
			],
			messageId: "<worker-self@example.com>",
		});
	});

	it("joins duplicate references headers from the worker", () => {
		const headers = new Headers();
		headers.append("References", "<first@example.com>");
		headers.append("References", "<second@example.com>");

		expect(
			extractThreadingHeaders(headers, {
				headers: [],
				headerLines: [],
				attachments: [],
			}).references,
		).toEqual(["<first@example.com>", "<second@example.com>"]);
	});
});
