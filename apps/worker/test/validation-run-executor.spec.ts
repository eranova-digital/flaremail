import { describe, expect, it } from "vitest";

import { advanceValidationRunPhase } from "../src/lib/domain-validation/validation-run-state";
import { ValidationRunExecutor } from "../src/lib/domain-validation/validation-run-executor";

describe("advanceValidationRunPhase", () => {
	it("short-circuits to completed on mx failure", () => {
		expect(advanceValidationRunPhase("dns", "mx_failed")).toBe("completed");
	});

	it("moves to await_receive after successful send", () => {
		expect(advanceValidationRunPhase("send", "send_ok")).toBe("await_receive");
	});

	it("completes after loop receive", () => {
		expect(advanceValidationRunPhase("await_receive", "received")).toBe(
			"completed",
		);
	});

	it("completes on receive timeout", () => {
		expect(advanceValidationRunPhase("await_receive", "timeout")).toBe(
			"completed",
		);
	});
});

describe("ValidationRunExecutor", () => {
	it("exports executor class", () => {
		expect(typeof ValidationRunExecutor.processTimedOutRuns).toBe("function");
	});
});
