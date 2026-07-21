import { describe, expect, it } from "vitest";

import {
	assertValidPhoneNumber,
	isValidPhoneNumber,
	normalizePhoneInput,
} from "../src/lib/validate-phone";

describe("validate-phone", () => {
	it("normalizes empty values to null", () => {
		expect(normalizePhoneInput(null)).toBeNull();
		expect(normalizePhoneInput(undefined)).toBeNull();
		expect(normalizePhoneInput("")).toBeNull();
		expect(normalizePhoneInput("   ")).toBeNull();
	});

	it("treats country-calling-code-only values as empty", () => {
		expect(normalizePhoneInput("+1")).toBeNull();
		expect(normalizePhoneInput("+40")).toBeNull();
		expect(normalizePhoneInput("+44")).toBeNull();
		expect(assertValidPhoneNumber("+1")).toBeNull();
	});

	it("accepts E.164 numbers", () => {
		expect(isValidPhoneNumber("+14155552671")).toBe(true);
		expect(isValidPhoneNumber("+442071838750")).toBe(true);
		expect(isValidPhoneNumber("+8613812345678")).toBe(true);
		expect(normalizePhoneInput("+14155552671")).toBe("+14155552671");
	});

	it("rejects non-E.164 values", () => {
		expect(isValidPhoneNumber("14155552671")).toBe(false);
		expect(isValidPhoneNumber("+1")).toBe(false);
		expect(isValidPhoneNumber("(415) 555-2671")).toBe(false);
		expect(isValidPhoneNumber("+0123456789")).toBe(false);
		expect(isValidPhoneNumber("+141555526711234567")).toBe(false);
	});

	it("assertValidPhoneNumber returns null or normalized value", () => {
		expect(assertValidPhoneNumber("")).toBeNull();
		expect(assertValidPhoneNumber("+14155552671")).toBe("+14155552671");
		expect(() => assertValidPhoneNumber("555-2671")).toThrow(/E\.164/);
		expect(() => assertValidPhoneNumber("+14155")).toThrow(/E\.164/);
	});
});
