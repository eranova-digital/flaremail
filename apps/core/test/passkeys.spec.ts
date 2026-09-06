import { describe, expect, it } from "vitest";

import { resolveWebAuthnConfig } from "../src/lib/auth/webauthn-config";

const env = { WEB_ORIGIN: "https://mail.example.com" } as Env;

describe("resolveWebAuthnConfig", () => {
	it("derives rpID and origin from the request", () => {
		const request = new Request("https://mail.example.com/api/v1/auth/passkeys", {
			headers: {
				Origin: "https://mail.example.com",
			},
		});

		expect(resolveWebAuthnConfig(request, env)).toEqual({
			rpID: "mail.example.com",
			rpName: "Flaremail",
			origin: "https://mail.example.com",
		});
	});

	it("normalizes 127.0.0.1 to localhost for local development", () => {
		const localEnv = { WEB_ORIGIN: "http://localhost:5173" } as Env;
		const request = new Request("http://127.0.0.1:8787/api/v1/auth/passkeys", {
			headers: {
				Origin: "http://localhost:5173",
			},
		});

		expect(resolveWebAuthnConfig(request, localEnv)).toEqual({
			rpID: "localhost",
			rpName: "Flaremail",
			origin: "http://localhost:5173",
		});
	});
});
