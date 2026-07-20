import type { DomainReadinessBadge, CheckSnapshot } from "./types";

export function computeReadinessBadge(
	runStatus: "checking" | "completed",
	checks: CheckSnapshot[],
): DomainReadinessBadge {
	if (runStatus === "checking") {
		return "checking";
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
