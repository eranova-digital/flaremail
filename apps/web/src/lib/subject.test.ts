import { describe, expect, it } from "vitest";

import {
	formatSubjectForDisplay,
	isSubjectChange,
	normalizeSubjectForComparison,
} from "./subject";

describe("normalizeSubjectForComparison", () => {
	it("strips reply prefixes case-insensitively", () => {
		expect(normalizeSubjectForComparison("Re: Hello")).toBe("Hello");
		expect(normalizeSubjectForComparison("re: Hello")).toBe("Hello");
		expect(normalizeSubjectForComparison("RE: Hello")).toBe("Hello");
	});

	it("strips forward prefixes case-insensitively", () => {
		expect(normalizeSubjectForComparison("Fwd: Hello")).toBe("Hello");
		expect(normalizeSubjectForComparison("fwd: Hello")).toBe("Hello");
		expect(normalizeSubjectForComparison("FWD: Hello")).toBe("Hello");
		expect(normalizeSubjectForComparison("FW: Hello")).toBe("Hello");
	});

	it("strips repeated prefixes", () => {
		expect(normalizeSubjectForComparison("Re: Re: Hello")).toBe("Hello");
		expect(normalizeSubjectForComparison("Fwd: Re: Hello")).toBe("Hello");
	});

	it("returns an empty string for blank subjects", () => {
		expect(normalizeSubjectForComparison(null)).toBe("");
		expect(normalizeSubjectForComparison("   ")).toBe("");
		expect(normalizeSubjectForComparison("Re:")).toBe("");
	});
});

describe("isSubjectChange", () => {
	it("ignores reply prefix changes", () => {
		expect(isSubjectChange("This is subject #1", "Re: This is subject #1")).toBe(
			false,
		);
	});

	it("ignores forward prefix changes", () => {
		expect(isSubjectChange("Hello", "Fwd: Hello")).toBe(false);
	});

	it("detects manual subject changes", () => {
		expect(
			isSubjectChange(
				"Re: This is subject #1",
				"Manually changed subject #2",
			),
		).toBe(true);
	});
});

describe("formatSubjectForDisplay", () => {
	it("returns the subject when present", () => {
		expect(formatSubjectForDisplay("Hello")).toBe("Hello");
	});

	it("returns a placeholder for blank subjects", () => {
		expect(formatSubjectForDisplay(null)).toBe("(no subject)");
		expect(formatSubjectForDisplay("   ")).toBe("(no subject)");
	});
});
