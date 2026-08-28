import type { DmarcResult } from "../../db/schema";

export function isEnforcingPolicy(policy: string | null | undefined): boolean {
	const normalized = policy?.trim().toLowerCase();
	return normalized === "quarantine" || normalized === "reject";
}

/** Pure eligibility helper for unit tests and verify-inbound. */
export function computeBimiEligibility(input: {
	dmarcResult: DmarcResult;
	policy: string | null;
	alignedDomain: string | null;
}): boolean {
	return (
		input.dmarcResult === "pass" &&
		isEnforcingPolicy(input.policy) &&
		input.alignedDomain !== null
	);
}
