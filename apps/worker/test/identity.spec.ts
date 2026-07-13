import { describe, expect, it } from "vitest";

import { createIdentity } from "../src/lib/auth/identity";

describe("Identity", () => {
	it("exposes resolvePrincipal", () => {
		const identity = createIdentity({} as Env);
		expect(typeof identity.resolvePrincipal).toBe("function");
	});

	it("binds session secret from env", () => {
		const identity = createIdentity({
			SESSION_SECRET: "test-session-secret",
		} as Env);
		expect(identity.sessionSecret()).toBe("test-session-secret");
	});

	it("delegates credential and session operations", () => {
		const identity = createIdentity({ SESSION_SECRET: "secret" } as Env);
		expect(typeof identity.signIn).toBe("function");
		expect(typeof identity.signOut).toBe("function");
		expect(typeof identity.getMe).toBe("function");
		expect(typeof identity.listSessions).toBe("function");
		expect(typeof identity.revokeSession).toBe("function");
		expect(typeof identity.revokeAllSessions).toBe("function");
	});

	it("delegates MFA operations with encryption key from env", () => {
		const identity = createIdentity({ SESSION_SECRET: "secret" } as Env);
		expect(typeof identity.getMfaStatus).toBe("function");
		expect(typeof identity.setupMfa).toBe("function");
		expect(typeof identity.confirmMfa).toBe("function");
		expect(typeof identity.disableMfa).toBe("function");
		expect(typeof identity.completeMfaSignIn).toBe("function");
	});

	it("delegates passkey operations", () => {
		const identity = createIdentity({ SESSION_SECRET: "secret" } as Env);
		expect(typeof identity.listPasskeys).toBe("function");
		expect(typeof identity.beginPasskeyRegistration).toBe("function");
		expect(typeof identity.completePasskeyRegistration).toBe("function");
		expect(typeof identity.beginPasskeySignIn).toBe("function");
		expect(typeof identity.completePasskeySignIn).toBe("function");
		expect(typeof identity.removePasskey).toBe("function");
	});
});
