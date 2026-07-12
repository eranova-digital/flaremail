import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { accountTotp, accounts } from "../db/schema";
import { decryptSecret, encryptSecret } from "../lib/auth/secret-encryption";
import {
	buildOtpAuthUrl,
	generateTotpSecret,
	verifyTotpCode,
} from "../lib/auth/totp";
import { verifyPassword } from "../lib/auth/password";
import { loadAccountProfile } from "../lib/auth/principal";
import { getInstanceSettings } from "./instance-settings";
import { assertMfaCanBeDisabled } from "./security-compliance";
import { createSession, type SessionMetadata } from "./auth-session";
import { verifyMfaDisableRecoveryCode } from "./recovery-email";

const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;

export type MfaStatus = {
	enabled: boolean;
	enabledAt: string | null;
};

export async function getMfaStatus(
	db: Database,
	accountId: string,
): Promise<MfaStatus> {
	const [row] = await db
		.select({
			enabledAt: accountTotp.enabledAt,
		})
		.from(accountTotp)
		.where(eq(accountTotp.accountId, accountId))
		.limit(1);

	return {
		enabled: Boolean(row?.enabledAt),
		enabledAt: row?.enabledAt?.toISOString() ?? null,
	};
}

export async function isMfaEnabled(
	db: Database,
	accountId: string,
): Promise<boolean> {
	const status = await getMfaStatus(db, accountId);
	return status.enabled;
}

export async function setupMfa(
	db: Database,
	input: { accountId: string; loginIdentifier: string; encryptionKey: string },
) {
	const existing = await getMfaStatus(db, input.accountId);
	if (existing.enabled) {
		throw new Error("Two-factor authentication is already enabled");
	}

	const secret = generateTotpSecret();
	const secretEncrypted = await encryptSecret(secret, input.encryptionKey);
	const now = new Date();

	await db
		.insert(accountTotp)
		.values({
			accountId: input.accountId,
			secretEncrypted,
			enabledAt: null,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: accountTotp.accountId,
			set: {
				secretEncrypted,
				enabledAt: null,
				updatedAt: now,
			},
		});

	return {
		secret,
		otpauthUrl: buildOtpAuthUrl({
			secret,
			accountName: input.loginIdentifier,
		}),
	};
}

export async function confirmMfa(
	db: Database,
	input: { accountId: string; code: string; encryptionKey: string },
) {
	const [row] = await db
		.select()
		.from(accountTotp)
		.where(eq(accountTotp.accountId, input.accountId))
		.limit(1);

	if (!row) {
		throw new Error("Start two-factor setup before confirming");
	}
	if (row.enabledAt) {
		throw new Error("Two-factor authentication is already enabled");
	}

	const secret = await decryptSecret(row.secretEncrypted, input.encryptionKey);
	const valid = await verifyTotpCode(secret, input.code);
	if (!valid) {
		throw new Error("Invalid authentication code");
	}

	const now = new Date();
	await db
		.update(accountTotp)
		.set({ enabledAt: now, updatedAt: now })
		.where(eq(accountTotp.accountId, input.accountId));

	return getMfaStatus(db, input.accountId);
}

export async function disableMfa(
	db: Database,
	input: {
		accountId: string;
		password: string;
		code: string;
		encryptionKey: string;
	},
) {
	const [account] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.id, input.accountId))
		.limit(1);

	if (!account?.passwordHash) {
		throw new Error("Account not found");
	}

	const passwordValid = await verifyPassword(input.password, account.passwordHash);
	if (!passwordValid) {
		throw new Error("Invalid password");
	}

	const [row] = await db
		.select()
		.from(accountTotp)
		.where(eq(accountTotp.accountId, input.accountId))
		.limit(1);

	if (!row?.enabledAt) {
		throw new Error("Two-factor authentication is not enabled");
	}

	const settings = await getInstanceSettings(db);
	assertMfaCanBeDisabled(
		{ isIntendant: account.isIntendant, role: account.role },
		settings,
	);

	const profile = await loadAccountProfile(db, input.accountId);
	const recoveryAddress = profile?.recoveryAddress?.trim();

	if (recoveryAddress) {
		await verifyMfaDisableRecoveryCode(db, {
			accountId: input.accountId,
			code: input.code,
			recoveryAddress,
		});
	} else {
		const secret = await decryptSecret(row.secretEncrypted, input.encryptionKey);
		const valid = await verifyTotpCode(secret, input.code);
		if (!valid) {
			throw new Error("Invalid authentication code");
		}
	}

	await db.delete(accountTotp).where(eq(accountTotp.accountId, input.accountId));
	return getMfaStatus(db, input.accountId);
}

export async function adminDisableMfa(
	db: Database,
	accountId: string,
): Promise<MfaStatus> {
	const status = await getMfaStatus(db, accountId);
	if (!status.enabled) {
		throw new Error("Two-factor authentication is not enabled");
	}

	const [account] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);
	if (!account) {
		throw new Error("Account not found");
	}

	const settings = await getInstanceSettings(db);
	assertMfaCanBeDisabled(
		{ isIntendant: account.isIntendant, role: account.role },
		settings,
	);

	await db.delete(accountTotp).where(eq(accountTotp.accountId, accountId));
	return getMfaStatus(db, accountId);
}

export async function createMfaChallengeToken(
	accountId: string,
	encryptionKey: string,
): Promise<string> {
	const secret = new TextEncoder().encode(encryptionKey);
	return new SignJWT({ accountId, typ: "mfa_challenge" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime(Math.floor((Date.now() + MFA_CHALLENGE_TTL_MS) / 1000))
		.sign(secret);
}

export async function verifyMfaChallengeToken(
	token: string,
	encryptionKey: string,
): Promise<string> {
	const secret = new TextEncoder().encode(encryptionKey);
	const { payload } = await jwtVerify(token, secret);
	if (payload.typ !== "mfa_challenge" || typeof payload.accountId !== "string") {
		throw new Error("Invalid MFA challenge");
	}
	return payload.accountId;
}

export async function completeMfaSignIn(
	db: Database,
	input: {
		mfaToken: string;
		code: string;
		encryptionKey: string;
	},
	sessionMetadata?: SessionMetadata,
) {
	const accountId = await verifyMfaChallengeToken(
		input.mfaToken,
		input.encryptionKey,
	);

	const [row] = await db
		.select()
		.from(accountTotp)
		.where(eq(accountTotp.accountId, accountId))
		.limit(1);

	if (!row?.enabledAt) {
		throw new Error("Two-factor authentication is not enabled for this account");
	}

	const secret = await decryptSecret(row.secretEncrypted, input.encryptionKey);
	const valid = await verifyTotpCode(secret, input.code);
	if (!valid) {
		throw new Error("Invalid authentication code");
	}

	return createSession(db, accountId, sessionMetadata);
}

export async function verifyAccountTotpCode(
	db: Database,
	input: { accountId: string; code: string; encryptionKey: string },
): Promise<boolean> {
	const [row] = await db
		.select()
		.from(accountTotp)
		.where(eq(accountTotp.accountId, input.accountId))
		.limit(1);

	if (!row?.enabledAt) {
		return false;
	}

	const secret = await decryptSecret(row.secretEncrypted, input.encryptionKey);
	return verifyTotpCode(secret, input.code);
}
