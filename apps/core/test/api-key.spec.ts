import { describe, expect, it } from "vitest";

import {
	API_KEY_PREFIX,
	KEY_PREFIX_LENGTH,
	buildSecret,
} from "../src/lib/auth/api-key";

describe("API key lifecycle", () => {
	it("mints secrets with the shared fmu_ prefix and key prefix length", () => {
		const { secret, keyPrefix } = buildSecret();

		expect(secret.startsWith(API_KEY_PREFIX)).toBe(true);
		expect(keyPrefix).toBe(secret.slice(0, KEY_PREFIX_LENGTH));
		expect(keyPrefix.length).toBe(KEY_PREFIX_LENGTH);
		expect(API_KEY_PREFIX).toBe("fmu_");
	});
});
