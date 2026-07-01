import { describe, expect, it } from "vitest";

import { runThreadAction } from "../src/services/thread-commands";

describe("thread restore folder snapshot", () => {
	it("exports restore action", () => {
		expect(typeof runThreadAction).toBe("function");
	});
});
