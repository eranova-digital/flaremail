import { describe, expect, it } from "vitest";

import {
	attachmentStorageKey,
	sanitizeFilename,
} from "../src/lib/attachment-utils";

describe("attachment utils", () => {
	it("sanitizes unsafe filename characters", () => {
		expect(sanitizeFilename("../evil/report.pdf", 0)).toBe(".._evil_report.pdf");
	});

	it("falls back to content id for inline parts without filenames", () => {
		expect(sanitizeFilename(null, 1, "<logo@example.com>")).toBe(
			"inline-logo@example.com",
		);
	});

	it("builds attachment storage keys", () => {
		expect(
			attachmentStorageKey(
				"550e8400-e29b-41d4-a716-446655440000",
				"660e8400-e29b-41d4-a716-446655440001",
				"report.pdf",
			),
		).toBe(
			"attachments/550e8400-e29b-41d4-a716-446655440000/660e8400-e29b-41d4-a716-446655440001/report.pdf",
		);
	});
});
