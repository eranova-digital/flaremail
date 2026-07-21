import { describe, expect, it } from "vitest";

import { isUniqueViolation } from "../src/lib/db/postgres-error";

describe("isUniqueViolation", () => {
	it("detects top-level Postgres 23505", () => {
		expect(isUniqueViolation({ code: "23505", message: "duplicate" })).toBe(
			true,
		);
	});

	it("detects Drizzle-wrapped cause with 23505", () => {
		const error = new Error("Failed query: insert into mailboxes");
		(error as Error & { cause: unknown }).cause = {
			code: "23505",
			message: 'duplicate key value violates unique constraint "mailboxes_address_unique"',
		};
		expect(isUniqueViolation(error)).toBe(true);
	});

	it("detects duplicate-key message when code is missing", () => {
		expect(
			isUniqueViolation({
				message:
					'duplicate key value violates unique constraint "mailboxes_address_unique"',
			}),
		).toBe(true);
	});

	it("returns false for unrelated errors", () => {
		expect(isUniqueViolation(new Error("boom"))).toBe(false);
		expect(isUniqueViolation({ code: "23503" })).toBe(false);
	});
});
