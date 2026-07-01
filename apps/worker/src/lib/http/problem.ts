export const PROBLEM_CONTENT_TYPE = "application/problem+json";

export type ProblemDetails = {
	type: string;
	title: string;
	status: number;
	detail: string;
	instance?: string;
	code?: string;
};

const STATUS_TITLES: Record<number, string> = {
	400: "Bad Request",
	401: "Unauthorized",
	404: "Not Found",
	413: "Content Too Large",
	429: "Too Many Requests",
	500: "Internal Server Error",
};

export function problemTypeUri(code: string): string {
	return `/api/v1/problems/${code.replace(/_/g, "-").toLowerCase()}`;
}

export function problemTitle(status: number): string {
	return STATUS_TITLES[status] ?? "Error";
}

export function buildProblemDetails(
	status: number,
	detail: string,
	options?: {
		code?: string;
		instance?: string;
		title?: string;
		type?: string;
	},
): ProblemDetails {
	const code = options?.code ?? defaultCodeForStatus(status);

	return {
		type: options?.type ?? problemTypeUri(code),
		title: options?.title ?? problemTitle(status),
		status,
		detail,
		...(options?.instance ? { instance: options.instance } : {}),
		code,
	};
}

export function problemResponse(
	status: number,
	detail: string,
	options?: {
		code?: string;
		instance?: string;
		title?: string;
		type?: string;
	},
): Response {
	const body = buildProblemDetails(status, detail, options);

	return Response.json(body, {
		status,
		headers: {
			"Content-Type": PROBLEM_CONTENT_TYPE,
		},
	});
}

function defaultCodeForStatus(status: number): string {
	switch (status) {
		case 400:
			return "bad-request";
		case 401:
			return "unauthorized";
		case 404:
			return "not-found";
		case 413:
			return "content-too-large";
		case 429:
			return "rate-limit-exceeded";
		default:
			return "internal-error";
	}
}

export function requestInstance(request: Request): string {
	return new URL(request.url).pathname;
}

export function validationError(request: Request, detail: string): Response {
	return problemResponse(400, detail, {
		code: "validation-error",
		instance: requestInstance(request),
	});
}
