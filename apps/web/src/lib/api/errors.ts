import i18n from "@/lib/i18n";
import type { ProblemDetails } from "@/lib/api/client";

export class ApiError extends Error {
	readonly problem?: ProblemDetails;
	readonly status?: number;

	constructor(message: string, problem?: ProblemDetails, status?: number) {
		super(message);
		this.name = "ApiError";
		this.problem = problem;
		this.status = status;
	}
}

export function isNotFoundError(error: unknown): boolean {
	if (error instanceof ApiError) {
		return error.status === 404 || error.problem?.code === "not-found";
	}

	if (error && typeof error === "object") {
		const problem = error as ProblemDetails;
		return problem.status === 404 || problem.code === "not-found";
	}

	return false;
}

export function isNoRecoveryEmailError(error: unknown): boolean {
	return (
		error instanceof ApiError && error.problem?.code === "no-recovery-email"
	);
}

/**
 * Resolve a user-facing error message.
 * Prefers `ProblemDetails.code` → i18n `errors:<code>`; falls back to English
 * `detail` / Error.message for unknown codes (e.g. external API clients).
 */
export function getErrorMessage(error: unknown): string {
	const problem = extractProblem(error);
	if (problem?.code) {
		const key = problem.code;
		if (i18n.exists(key, { ns: "errors" })) {
			return i18n.t(key, { ns: "errors" });
		}
	}

	if (problem?.detail) {
		return problem.detail;
	}

	if (error instanceof ApiError) {
		return error.message;
	}

	if (error instanceof Error) {
		return error.message;
	}

	return i18n.t("something-went-wrong", {
		ns: "errors",
		defaultValue: "Something went wrong",
	});
}

function extractProblem(error: unknown): ProblemDetails | undefined {
	if (error instanceof ApiError) {
		return error.problem;
	}
	if (error && typeof error === "object" && "detail" in error) {
		return error as ProblemDetails;
	}
	return undefined;
}

export function assertData<T>(data: T | undefined, label: string): T {
	if (data === undefined) {
		throw new ApiError(`No data in ${label} response`);
	}

	return data;
}
