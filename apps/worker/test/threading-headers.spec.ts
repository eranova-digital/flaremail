import { describe, expect, it } from "vitest";

import { normalizeMessageId } from "../src/lib/threading-headers";

describe("threading header helpers", () => {
	it("normalizes folded message ids", () => {
		expect(normalizeMessageId("<abc\n @mail.com>")).toBe("<abc @mail.com>");
	});
});
