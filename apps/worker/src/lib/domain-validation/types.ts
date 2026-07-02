export type DomainReadinessBadge = "checking" | "fail" | "healthy" | "unhealthy";

export type ValidationCheckKey =
	| "mx"
	| "dmarc_rua"
	| "loop_send"
	| "loop_receive";

export type ValidationCheckStatus = "pending" | "passed" | "failed" | "skipped";

export type ValidationCheckTier = "critical" | "advisory";

export type CheckOutcome = {
	status: Exclude<ValidationCheckStatus, "pending">;
	code?: string;
	message?: string;
};

export type CheckSnapshot = {
	checkKey: ValidationCheckKey;
	tier: ValidationCheckTier;
	status: ValidationCheckStatus;
	code: string | null;
	message: string | null;
};
