import { describe, expect, it } from "vitest";

import {
	buildRateLimitKey,
	normalizeRateLimitIdentifier,
} from "../src/lib/http/rate-limit";

describe("rate-limit keys", () => {
	it("normalizes identifiers", () => {
		expect(normalizeRateLimitIdentifier("  Pat@Example.COM ")).toBe(
			"pat@example.com",
		);
	});

	it("builds ip-only and ip+identifier keys", () => {
		expect(buildRateLimitKey("1.2.3.4")).toBe("1.2.3.4");
		expect(buildRateLimitKey("1.2.3.4", "  User@Host ")).toBe(
			"1.2.3.4:user@host",
		);
	});
});
