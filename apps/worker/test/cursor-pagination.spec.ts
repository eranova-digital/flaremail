import { describe, expect, it } from "vitest";

import {
	decodeCursor,
	encodeCursor,
	parseLimit,
} from "../src/lib/http/cursor-pagination";

describe("cursor pagination", () => {
	it("round-trips cursor payloads", () => {
		const payload = {
			sortAt: "2026-06-30T12:00:00.000Z",
			id: "abc-123",
		};

		expect(decodeCursor(encodeCursor(payload))).toEqual(payload);
	});

	it("clamps limit values", () => {
		expect(parseLimit(null)).toBe(50);
		expect(parseLimit("200")).toBe(100);
		expect(parseLimit("0")).toBe(1);
	});
});
