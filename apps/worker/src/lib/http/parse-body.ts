import { problemResponse, requestInstance } from "./problem";

export async function parseJsonBody<T>(request: Request): Promise<T | Response> {
	try {
		return (await request.json()) as T;
	} catch {
		return problemResponse(400, "Request body must be valid JSON", {
			code: "invalid-json",
			instance: requestInstance(request),
		});
	}
}
