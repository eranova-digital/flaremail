import type { DomainReadinessBadge, CheckSnapshot } from "./types";

export function computeReadinessBadge(
	runStatus: "checking" | "completed" | "cancelled",
	checks: CheckSnapshot[],
): DomainReadinessBadge {
	if (runStatus === "checking") {
		return "checking";
	}

	// Cancelled runs are incomplete — any critical check that did not pass
	// means readiness is not verified.
	if (runStatus === "cancelled") {
		const criticalIncomplete = checks.some(
			(check) => check.tier === "critical" && check.status !== "passed",
		);
		if (criticalIncomplete) {
			return "fail";
		}

		const advisoryFailed = checks.some(
			(check) => check.tier === "advisory" && check.status === "failed",
		);
		if (advisoryFailed) {
			return "unhealthy";
		}

		const advisoryIncomplete = checks.some(
			(check) =>
				check.tier === "advisory" &&
				check.status !== "passed" &&
				check.status !== "failed",
		);
		if (advisoryIncomplete) {
			return "unhealthy";
		}

		return "healthy";
	}

	const criticalFailed = checks.some(
		(check) => check.tier === "critical" && check.status === "failed",
	);
	if (criticalFailed) {
		return "fail";
	}

	const advisoryFailed = checks.some(
		(check) => check.tier === "advisory" && check.status === "failed",
	);
	if (advisoryFailed) {
		return "unhealthy";
	}

	return "healthy";
}
