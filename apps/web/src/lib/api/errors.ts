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

export function getErrorMessage(error: unknown): string {
	if (error instanceof ApiError) {
		return error.problem?.detail ?? error.message;
	}

	if (error && typeof error === "object" && "detail" in error) {
		const detail = (error as ProblemDetails).detail;
		if (typeof detail === "string") {
			return detail;
		}
	}

	if (error instanceof Error) {
		return error.message;
	}

	return "Something went wrong";
}

export function assertData<T>(data: T | undefined, label: string): T {
	if (data === undefined) {
		throw new ApiError(`No data in ${label} response`);
	}

	return data;
}
