import { describe, expect, it } from "vitest";

import { computeReadinessBadge } from "../src/lib/domain-validation/compute-badge";
import type { CheckSnapshot } from "../src/lib/domain-validation/types";

const baseChecks: CheckSnapshot[] = [
	{ checkKey: "mx", tier: "critical", status: "passed", code: null, message: null },
	{
		checkKey: "dmarc_rua",
		tier: "advisory",
		status: "passed",
		code: null,
		message: null,
	},
	{
		checkKey: "loop_send",
		tier: "critical",
		status: "passed",
		code: null,
		message: null,
	},
	{
		checkKey: "loop_receive",
		tier: "critical",
		status: "passed",
		code: null,
		message: null,
	},
];

describe("computeReadinessBadge", () => {
	it("returns checking while run is active", () => {
		expect(computeReadinessBadge("checking", baseChecks)).toBe("checking");
	});

	it("returns healthy when all checks pass", () => {
		expect(computeReadinessBadge("completed", baseChecks)).toBe("healthy");
	});

	it("returns fail when a critical check failed", () => {
		const checks = baseChecks.map((check) =>
			check.checkKey === "mx"
				? { ...check, status: "failed" as const }
				: check,
		);
		expect(computeReadinessBadge("completed", checks)).toBe("fail");
	});

	it("returns unhealthy when only advisory checks failed", () => {
		const checks = baseChecks.map((check) =>
			check.checkKey === "dmarc_rua"
				? { ...check, status: "failed" as const }
				: check,
		);
		expect(computeReadinessBadge("completed", checks)).toBe("unhealthy");
	});
});
