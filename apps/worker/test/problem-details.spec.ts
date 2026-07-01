import { describe, expect, it } from "vitest";

import {
	PROBLEM_CONTENT_TYPE,
	buildProblemDetails,
	problemResponse,
} from "../src/lib/http/problem";

describe("RFC 9457 problem details", () => {
	it("builds required fields", () => {
		const problem = buildProblemDetails(400, "Invalid input", {
			code: "validation-error",
			instance: "/api/v1/search",
		});

		expect(problem).toEqual({
			type: "/api/v1/problems/validation-error",
			title: "Bad Request",
			status: 400,
			detail: "Invalid input",
			instance: "/api/v1/search",
			code: "validation-error",
		});
	});

	it("sets application/problem+json content type", async () => {
		const response = problemResponse(404, "Not found", {
			code: "not-found",
		});

		expect(response.status).toBe(404);
		expect(response.headers.get("Content-Type")).toContain(PROBLEM_CONTENT_TYPE);
		const body = await response.json();
		expect(body.title).toBe("Not Found");
	});
});
