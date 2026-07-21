import { describe, expect, it } from "vitest";

import { ensureIntendantBootstrapped } from "../src/services/intendant-bootstrap";

function createMockDb(existingIntendant: { id: string } | null) {
	const inserts: unknown[] = [];
	return {
		inserts,
		db: {
			select: () => ({
				from: () => ({
					where: () => ({
						limit: async () => (existingIntendant ? [existingIntendant] : []),
					}),
				}),
			}),
			insert: () => ({
				values: async (row: unknown) => {
					inserts.push(row);
				},
			}),
		} as never,
	};
}

describe("ensureIntendantBootstrapped", () => {
	it("creates the intendant account when none exists", async () => {
		const { db, inserts } = createMockDb(null);
		const result = await ensureIntendantBootstrapped(db);

		expect(result.created).toBe(true);
		expect(result.password).toBeTruthy();
		expect(inserts).toHaveLength(2);
	});

	it("returns created false when the intendant already exists", async () => {
		const { db, inserts } = createMockDb({ id: "existing-intendant" });
		const result = await ensureIntendantBootstrapped(db);

		expect(result).toEqual({ created: false });
		expect(inserts).toHaveLength(0);
	});
});
