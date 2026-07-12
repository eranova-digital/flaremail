import { and, eq, gt } from "drizzle-orm";

import type { Database } from "../db/client";
import { accountProfiles, emailVerificationCodes } from "../db/schema";
import { formatCode } from "../lib/auth/crypto";
import { hashSecret } from "../lib/auth/password";
import {
	mfaDisableRecoveryCodeText,
	recoveryEmailVerificationText,
	resolveAccountSenderDomain,
	sendTransactionalEmail,
	type TransactionalEmailDeps,
} from "../lib/auth/transactional-email";
import { parseEmailAddress } from "../lib/normalize-email-address";

const VERIFICATION_TTL_MS = 15 * 60 * 1000;

type VerificationPurpose = "recovery_setup" | "mfa_disable";

function normalizeCode(code: string): string {
	return code.trim().toUpperCase();
}

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

function assertValidExternalEmail(email: string): string {
	const normalized = normalizeEmail(email);
	const parsed = parseEmailAddress(normalized);
	if (!parsed) {
		throw new Error("Invalid recovery email address");
	}
	return normalized;
}

async function createVerificationCode(
	db: Database,
	input: {
		accountId: string;
		targetEmail: string;
		purpose: VerificationPurpose;
	},
): Promise<string> {
	const code = formatCode();
	const now = new Date();
	await db.insert(emailVerificationCodes).values({
		id: crypto.randomUUID(),
		accountId: input.accountId,
		targetEmail: input.targetEmail,
		purpose: input.purpose,
		codeHash: await hashSecret(normalizeCode(code)),
		expiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS),
		createdAt: now,
	});
	return code;
}

async function verifyCode(
	db: Database,
	input: {
		accountId: string;
		code: string;
		purpose: VerificationPurpose;
		targetEmail?: string;
	},
): Promise<void> {
	const codeHash = await hashSecret(normalizeCode(input.code));
	const now = new Date();
	const conditions = [
		eq(emailVerificationCodes.accountId, input.accountId),
		eq(emailVerificationCodes.purpose, input.purpose),
		eq(emailVerificationCodes.codeHash, codeHash),
		gt(emailVerificationCodes.expiresAt, now),
	];
	if (input.targetEmail) {
		conditions.push(
			eq(emailVerificationCodes.targetEmail, normalizeEmail(input.targetEmail)),
		);
	}

	const [row] = await db
		.select()
		.from(emailVerificationCodes)
		.where(and(...conditions))
		.limit(1);

	if (!row || row.usedAt) {
		throw new Error("Invalid or expired verification code");
	}

	await db
		.update(emailVerificationCodes)
		.set({ usedAt: now })
		.where(eq(emailVerificationCodes.id, row.id));
}

async function sendVerificationEmail(
	db: Database,
	deps: TransactionalEmailDeps,
	input: {
		accountId: string;
		to: string;
		subject: string;
		text: string;
	},
): Promise<void> {
	const domainName = await resolveAccountSenderDomain(db, input.accountId);
	if (!domainName) {
		throw new Error("Could not determine sender domain for this account");
	}

	await sendTransactionalEmail(db, deps, {
		domainName,
		to: input.to,
		subject: input.subject,
		text: input.text,
	});
}

export async function sendRecoveryEmailSetupCode(
	db: Database,
	deps: TransactionalEmailDeps,
	input: { accountId: string; recoveryAddress: string },
): Promise<void> {
	const targetEmail = assertValidExternalEmail(input.recoveryAddress);
	const code = await createVerificationCode(db, {
		accountId: input.accountId,
		targetEmail,
		purpose: "recovery_setup",
	});

	await sendVerificationEmail(db, deps, {
		accountId: input.accountId,
		to: targetEmail,
		subject: "Verify your Flaremail recovery email",
		text: recoveryEmailVerificationText(code),
	});
}

export async function verifyAndSetRecoveryEmail(
	db: Database,
	input: { accountId: string; recoveryAddress: string; code: string },
): Promise<void> {
	const targetEmail = assertValidExternalEmail(input.recoveryAddress);
	await verifyCode(db, {
		accountId: input.accountId,
		code: input.code,
		purpose: "recovery_setup",
		targetEmail,
	});

	const now = new Date();
	await db
		.update(accountProfiles)
		.set({ recoveryAddress: targetEmail, updatedAt: now })
		.where(eq(accountProfiles.accountId, input.accountId));
}

export async function sendMfaDisableRecoveryCode(
	db: Database,
	deps: TransactionalEmailDeps,
	accountId: string,
	recoveryAddress: string,
): Promise<void> {
	const targetEmail = normalizeEmail(recoveryAddress);
	const code = await createVerificationCode(db, {
		accountId,
		targetEmail,
		purpose: "mfa_disable",
	});

	await sendVerificationEmail(db, deps, {
		accountId,
		to: targetEmail,
		subject: "Disable two-factor authentication on your Flaremail account",
		text: mfaDisableRecoveryCodeText(code),
	});
}

export async function verifyMfaDisableRecoveryCode(
	db: Database,
	input: { accountId: string; code: string; recoveryAddress: string },
): Promise<void> {
	await verifyCode(db, {
		accountId: input.accountId,
		code: input.code,
		purpose: "mfa_disable",
		targetEmail: input.recoveryAddress,
	});
}
