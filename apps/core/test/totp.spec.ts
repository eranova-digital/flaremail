import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "../src/lib/auth/secret-encryption";
import {
	buildOtpAuthUrl,
	generateTotpSecret,
	getCurrentTotpCode,
	verifyTotpCode,
} from "../src/lib/auth/totp";

const TEST_KEY = "test-session-secret-for-totp";

describe("TOTP", () => {
	it("generates secrets in base32 alphabet", () => {
		const secret = generateTotpSecret();
		expect(secret).toMatch(/^[A-Z2-7]+$/);
		expect(secret.length).toBe(20);
	});

	it("builds otpauth URLs", () => {
		const url = buildOtpAuthUrl({
			secret: "JBSWY3DPEHPK3PXP",
			accountName: "user@example.com",
		});
		expect(url).toContain("otpauth://totp/Flaremail%3Auser%40example.com");
		expect(url).toContain("secret=JBSWY3DPEHPK3PXP");
	});

	it("encrypts and decrypts secrets", async () => {
		const encrypted = await encryptSecret("JBSWY3DPEHPK3PXP", TEST_KEY);
		const decrypted = await decryptSecret(encrypted, TEST_KEY);
		expect(decrypted).toBe("JBSWY3DPEHPK3PXP");
	});

	it("verifies the current code for a secret", async () => {
		const secret = generateTotpSecret();
		const code = await getCurrentTotpCode(secret);
		expect(await verifyTotpCode(secret, code)).toBe(true);
		expect(await verifyTotpCode(secret, "000000")).toBe(false);
	});
});
