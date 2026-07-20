import { describe, expect, it } from "vitest";

import { buildLogsSearchCondition } from "../src/services/logs";

/** Flatten drizzle SQL chunks into a string for structural assertions. */
function sqlText(fragment: ReturnType<typeof buildLogsSearchCondition>): string {
	const chunks = (fragment as { queryChunks?: unknown[] }).queryChunks ?? [];
	return chunks
		.map((chunk) => {
			if (typeof chunk === "string") {
				return chunk;
			}
			if (chunk && typeof chunk === "object" && "value" in chunk) {
				const value = (chunk as { value: unknown }).value;
				return Array.isArray(value) ? value.join("") : String(value ?? "");
			}
			if (chunk && typeof chunk === "object" && "name" in chunk) {
				return String((chunk as { name: string }).name);
			}
			return "";
		})
		.join("");
}

describe("buildLogsSearchCondition", () => {
	it("keeps raw field matches and resolved-label EXISTS clauses", () => {
		const text = sqlText(buildLogsSearchCondition("acme"));

		expect(text).toContain("jsonb_each");
		expect(text).toMatch(/mailbox/i);
		expect(text).toMatch(/domain/i);
		expect(text).toMatch(/thread/i);
		expect(text).toMatch(/message/i);
		expect(text).toMatch(/identity/i);
		expect(text).toMatch(/oidc/i);
		expect(text).toMatch(/api.?key/i);
		expect(text).toMatch(/invite/i);
		expect(text).toMatch(/account/i);
		expect(text).toMatch(/login_identifier|loginIdentifier/i);
		expect(text).toMatch(/CONCAT_WS/i);
		expect(text).toMatch(/actor/i);
	});

	it("binds the search pattern for ILIKE", () => {
		const text = sqlText(buildLogsSearchCondition("patrick@example.com"));
		expect(text.length).toBeGreaterThan(0);
		expect(text).toMatch(/ILIKE/i);
	});
});
