import type { Database } from "../../../db/client";
import { resolvePrincipal } from "../resolve-principal";
import type { Principal } from "../types";
import type { AccountProfileInput } from "../../../services/accounts";
import {
	activateInvite,
	getMe,
	previewInvite,
	regenerateIntendantPassword,
	requestPasswordReset,
	resetPasswordWithCode,
	sessionSecretForEnv,
	signIn,
	signOut,
	type NoRecoveryEmailError,
} from "../../../services/auth";
import {
	listActiveSessions,
	revokeAllSessions,
	revokeSession,
	type SessionMetadata,
} from "../../../services/auth-session";
import {
	completeMfaSignIn,
	confirmMfa,
	disableMfa,
	getMfaStatus,
	setupMfa,
} from "../../../services/mfa";

export type { NoRecoveryEmailError, SessionMetadata };

/**
 * Identity facade: session resolution, credentials, MFA, and profile behind one
 * interface. Env is bound at construction; database is passed per operation.
 */
export class Identity {
	constructor(private readonly env: Env) {}

	resolvePrincipal(request: Request): Promise<Principal | Response> {
		return resolvePrincipal(request, this.env);
	}

	sessionSecret(): string {
		return sessionSecretForEnv(this.env);
	}

	signIn(
		db: Database,
		input: { loginIdentifier: string; password: string },
		metadata: SessionMetadata,
	) {
		return signIn(db, input, this.sessionSecret(), metadata);
	}

	signOut(db: Database, sessionToken: string) {
		return signOut(db, sessionToken);
	}

	getMe(db: Database, accountId: string) {
		return getMe(db, accountId);
	}

	previewInvite(db: Database, code: string) {
		return previewInvite(db, code);
	}

	activateInvite(
		db: Database,
		input: {
			code: string;
			password: string;
			profile?: AccountProfileInput;
		},
		metadata?: SessionMetadata,
	) {
		return activateInvite(db, input, metadata);
	}

	requestPasswordReset(db: Database, input: { address: string }) {
		return requestPasswordReset(db, this.env.EMAIL, input);
	}

	resetPasswordWithCode(
		db: Database,
		input: { code: string; password: string },
	) {
		return resetPasswordWithCode(db, input);
	}

	regenerateIntendantPassword(db: Database, accountId: string) {
		return regenerateIntendantPassword(db, accountId);
	}

	listSessions(
		db: Database,
		accountId: string,
		currentSessionId?: string,
	) {
		return listActiveSessions(db, accountId, currentSessionId);
	}

	revokeSession(
		db: Database,
		accountId: string,
		sessionId: string,
		currentSessionId?: string,
	) {
		return revokeSession(db, accountId, sessionId, currentSessionId);
	}

	revokeAllSessions(
		db: Database,
		accountId: string,
		options?: { includeCurrent?: boolean; currentSessionId?: string },
	) {
		return revokeAllSessions(db, accountId, options);
	}

	getMfaStatus(db: Database, accountId: string) {
		return getMfaStatus(db, accountId);
	}

	setupMfa(
		db: Database,
		input: { accountId: string; loginIdentifier: string },
	) {
		return setupMfa(db, {
			...input,
			encryptionKey: this.sessionSecret(),
		});
	}

	confirmMfa(
		db: Database,
		input: { accountId: string; code: string },
	) {
		return confirmMfa(db, {
			...input,
			encryptionKey: this.sessionSecret(),
		});
	}

	disableMfa(
		db: Database,
		input: { accountId: string; password: string; code: string },
	) {
		return disableMfa(db, {
			...input,
			encryptionKey: this.sessionSecret(),
		});
	}

	completeMfaSignIn(
		db: Database,
		input: { mfaToken: string; code: string },
		metadata?: SessionMetadata,
	) {
		return completeMfaSignIn(
			db,
			{
				...input,
				encryptionKey: this.sessionSecret(),
			},
			metadata,
		);
	}
}

export function createIdentity(env: Env): Identity {
	return new Identity(env);
}
