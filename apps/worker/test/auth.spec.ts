import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import { formatCode } from "../src/lib/auth/crypto";

describe("password hashing", () => {
	it("verifies a password against its hash", async () => {
		const hash = await hashPassword("correct horse battery staple");
		expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
		expect(await verifyPassword("wrong", hash)).toBe(false);
	});
});

describe("invite codes", () => {
	it("formats codes as XXXX-XXXX", () => {
		const code = formatCode();
		expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
	});
});
