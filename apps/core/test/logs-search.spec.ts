import { describe, expect, it } from "vitest";

import { buildLogsSearchCondition } from "../src/services/logs";

/** Walk drizzle SQL / Param / StringChunk trees into a debug string. */
function sqlText(value: unknown, depth = 0): string {
	if (depth > 8 || value == null) {
		return "";
	}
	if (typeof value === "string") {
		return value;
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	if (Array.isArray(value)) {
		return value.map((item) => sqlText(item, depth + 1)).join("");
	}
	if (typeof value !== "object") {
		return "";
	}

	const record = value as Record<string, unknown>;
	if ("value" in record) {
		return sqlText(record.value, depth + 1);
	}
	if ("queryChunks" in record) {
		return sqlText(record.queryChunks, depth + 1);
	}
	if (Symbol.for("drizzle:Name") in record || "name" in record) {
		return String(record.name ?? "");
	}

	return Object.values(record)
		.map((item) => sqlText(item, depth + 1))
		.join("");
}

describe("buildLogsSearchCondition", () => {
	it("keeps raw field matches and resolved-label EXISTS clauses", () => {
		const fragment = buildLogsSearchCondition("acme");
		expect(fragment).toBeTruthy();

		const text = sqlText(fragment);
		expect(text.length).toBeGreaterThan(10);
		expect(text).toMatch(/jsonb_each/i);
		expect(text).toMatch(/mailbox/i);
		expect(text).toMatch(/domain/i);
		expect(text).toMatch(/thread/i);
		expect(text).toMatch(/message/i);
		expect(text).toMatch(/identity/i);
		expect(text).toMatch(/account/i);
		expect(text).toMatch(/ILIKE|ilike/i);
	});

	it("returns a distinct SQL fragment for different queries", () => {
		const a = buildLogsSearchCondition("alpha");
		const b = buildLogsSearchCondition("beta");
		expect(sqlText(a)).not.toEqual(sqlText(b));
	});
});
