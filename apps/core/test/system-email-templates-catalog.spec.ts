import { describe, expect, it } from "vitest";

import {
	SYSTEM_EMAIL_TEMPLATE_DEFINITIONS,
	applySystemTemplateTags,
	isSystemEmailTemplateKey,
} from "../src/lib/email-templates/system-catalog";

describe("system email template catalog", () => {
	it("includes the four system email keys", () => {
		expect(SYSTEM_EMAIL_TEMPLATE_DEFINITIONS.map((item) => item.key)).toEqual([
			"invite",
			"password_reset",
			"recovery_verify",
			"mfa_disable",
		]);
	});

	it("validates keys", () => {
		expect(isSystemEmailTemplateKey("invite")).toBe(true);
		expect(isSystemEmailTemplateKey("nope")).toBe(false);
	});

	it("replaces known tags and leaves unknown tags", () => {
		const html =
			"<p>Code {invite_code} / {code} expires {expires_in}. Keep {unknown}.</p>";
		expect(
			applySystemTemplateTags(html, {
				invite_code: "ABCD-EFGH",
				code: "ABCD-EFGH",
				expires_in: "7 days",
			}),
		).toBe(
			"<p>Code ABCD-EFGH / ABCD-EFGH expires 7 days. Keep {unknown}.</p>",
		);
	});
});
