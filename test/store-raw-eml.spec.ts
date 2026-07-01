import { describe, expect, it } from "vitest";

import { rawEmlKeyForMessageId } from "../src/lib/store-raw-eml";

describe("rawEmlKeyForMessageId", () => {
	it("builds the R2 object key for a message id", () => {
		expect(rawEmlKeyForMessageId("550e8400-e29b-41d4-a716-446655440000")).toBe(
			"raw/550e8400-e29b-41d4-a716-446655440000.eml",
		);
	});
});
