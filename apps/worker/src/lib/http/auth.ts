import { problemResponse, requestInstance } from "./problem";

export function requireAuth(request: Request, env: Env): Response | null {
	const instance = requestInstance(request);
	const header = request.headers.get("Authorization");
	if (!header?.startsWith("Bearer ")) {
		return problemResponse(
			401,
			"Missing or invalid Authorization header. Expected: Bearer <token>",
			{ code: "unauthorized", instance },
		);
	}

	const token = header.slice("Bearer ".length).trim();
	if (!env.API_BEARER_TOKEN || token !== env.API_BEARER_TOKEN) {
		return problemResponse(401, "Invalid bearer token", {
			code: "unauthorized",
			instance,
		});
	}

	return null;
}
