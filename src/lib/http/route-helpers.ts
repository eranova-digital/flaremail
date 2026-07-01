import { problemResponse, requestInstance } from "./problem";

export function requireQueryParam(
	request: Request,
	name: string,
): string | Response {
	const url = new URL(request.url);
	const value = url.searchParams.get(name);
	if (!value?.trim()) {
		return problemResponse(400, `Query parameter '${name}' is required`, {
			code: "missing-query-parameter",
			instance: requestInstance(request),
		});
	}

	return value.trim();
}

export { outboundContext } from "./route-helpers-outbound";
