import { describe, expect, it } from "vitest";

import { buildPreview } from "../src/lib/messages/message-utils";

describe("buildPreview", () => {
	it("truncates text body to 200 characters", () => {
		const textBody = "a".repeat(250);
		expect(buildPreview(textBody)).toHaveLength(200);
		expect(buildPreview(textBody)).toBe("a".repeat(200));
	});

	it("returns null for empty text body", () => {
		expect(buildPreview(null)).toBeNull();
	});
});
