import { describe, expect, it } from "vitest";

import {
	buildValidationBodyText,
	extractValidationToken,
} from "../src/lib/domain-validation/validation-body";
import { VALIDATION_TOKEN_HEADER } from "../src/lib/domain-validation/constants";

describe("validation token extraction", () => {
	it("reads token from body text", () => {
		const token = "11111111-1111-1111-1111-111111111111";
		expect(extractValidationToken(buildValidationBodyText(token), new Headers())).toBe(
			token,
		);
	});

	it("prefers header token when present", () => {
		const headers = new Headers({
			[VALIDATION_TOKEN_HEADER]: "header-token",
		});
		expect(
			extractValidationToken(buildValidationBodyText("body-token"), headers),
		).toBe("header-token");
	});
});
