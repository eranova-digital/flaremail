import { and, eq, gt } from "drizzle-orm";

import type { Database } from "../db/client";
import {
	accountProfiles,
	accounts,
	invites,
	passwordResetCodes,
	profileFieldLocks,
	sessions,
} from "../db/schema";
import { formatCode, randomToken } from "../lib/auth/crypto";
import {
	clearSessionCookieHeader,
	sessionCookieHeader,
} from "../lib/auth/cookies";
import { hashPassword, hashSecret, verifyPassword } from "../lib/auth/password";
import { loadAccountProfile } from "../lib/auth/principal";
import { requireSessionSecret } from "../lib/auth/resolve-principal";
import { ensureIntendantBootstrapped } from "./intendant-bootstrap";

const SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 24 * 60 * 60 * 1000;

export async function bootstrapAuth(db: Database) {
	return ensureIntendantBootstrapped(db);
}

export async function signIn(
	db: Database,
	input: { loginIdentifier: string; password: string },
) {
	const identifier = input.loginIdentifier.trim().toLowerCase();
	const [account] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.loginIdentifier, identifier))
		.limit(1);

	if (!account?.passwordHash) {
		throw new Error("Invalid credentials");
	}
	if (account.status === "suspended") {
		throw new Error("Account is suspended");
	}
	if (account.status === "pending") {
		throw new Error("Account is not activated");
	}

	const valid = await verifyPassword(input.password, account.passwordHash);
	if (!valid) {
		throw new Error("Invalid credentials");
	}

	return createSession(db, account.id);
}

export async function activateInvite(
	db: Database,
	input: { code: string; password: string; firstName?: string; lastName?: string },
) {
	const codeHash = await hashSecret(normalizeCode(input.code));
	const now = new Date();
	const [invite] = await db
		.select()
		.from(invites)
		.where(and(eq(invites.codeHash, codeHash), gt(invites.expiresAt, now)))
		.limit(1);

	if (!invite || invite.usedAt) {
		throw new Error("Invalid or expired invite code");
	}

	const [account] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.id, invite.accountId))
		.limit(1);
	if (!account || account.status !== "pending") {
		throw new Error("Invite is no longer valid");
	}

	await db
		.update(accounts)
		.set({
			status: "active",
			passwordHash: await hashPassword(input.password),
			activatedAt: now,
			updatedAt: now,
		})
		.where(eq(accounts.id, account.id));

	if (input.firstName || input.lastName) {
		await db
			.update(accountProfiles)
			.set({
				firstName: input.firstName ?? undefined,
				lastName: input.lastName ?? undefined,
				updatedAt: now,
			})
			.where(eq(accountProfiles.accountId, account.id));
	}

	await db
		.update(invites)
		.set({ usedAt: now })
		.where(eq(invites.id, invite.id));

	return createSession(db, account.id);
}

export async function signOut(db: Database, sessionToken: string) {
	const tokenHash = await hashSecret(sessionToken);
	await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
	return clearSessionCookieHeader();
}

export async function regenerateIntendantPassword(db: Database, accountId: string) {
	const [account] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);
	if (!account?.isIntendant) {
		throw new Error("Only the intendant can regenerate this password");
	}
	const password = randomToken(32);
	await db
		.update(accounts)
		.set({
			passwordHash: await hashPassword(password),
			updatedAt: new Date(),
		})
		.where(eq(accounts.id, accountId));
	return password;
}

export async function createPasswordResetCode(
	db: Database,
	input: { accountId: string; createdByAccountId: string },
) {
	const code = formatCode();
	const now = new Date();
	await db.insert(passwordResetCodes).values({
		id: crypto.randomUUID(),
		accountId: input.accountId,
		codeHash: await hashSecret(normalizeCode(code)),
		createdByAccountId: input.createdByAccountId,
		expiresAt: new Date(now.getTime() + RESET_TTL_MS),
		createdAt: now,
	});
	return code;
}

export async function resetPasswordWithCode(
	db: Database,
	input: { code: string; password: string },
) {
	const codeHash = await hashSecret(normalizeCode(input.code));
	const now = new Date();
	const [row] = await db
		.select()
		.from(passwordResetCodes)
		.where(
			and(
				eq(passwordResetCodes.codeHash, codeHash),
				gt(passwordResetCodes.expiresAt, now),
			),
		)
		.limit(1);
	if (!row || row.usedAt) {
		throw new Error("Invalid or expired reset code");
	}
	await db
		.update(accounts)
		.set({
			passwordHash: await hashPassword(input.password),
			updatedAt: now,
		})
		.where(eq(accounts.id, row.accountId));
	await db
		.update(passwordResetCodes)
		.set({ usedAt: now })
		.where(eq(passwordResetCodes.id, row.id));
}

export async function getMe(db: Database, accountId: string) {
	const [account] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.id, accountId))
		.limit(1);
	if (!account) {
		throw new Error("Account not found");
	}
	const profile = await loadAccountProfile(db, accountId);
	const lockedRows = await db
		.select({ fieldName: profileFieldLocks.fieldName })
		.from(profileFieldLocks)
		.where(eq(profileFieldLocks.accountId, accountId));

	return {
		id: account.id,
		isIntendant: account.isIntendant,
		role: account.role,
		status: account.status,
		loginIdentifier: account.loginIdentifier,
		primaryMailboxId: account.primaryMailboxId,
		lockedFields: lockedRows.map((row) => row.fieldName),
		profile: profile
			? {
					firstName: profile.firstName,
					lastName: profile.lastName,
					recoveryAddress: profile.recoveryAddress,
					phone: profile.phone,
					address: {
						country: profile.addressCountry,
						state: profile.addressState,
						city: profile.addressCity,
						line1: profile.addressLine1,
						line2: profile.addressLine2,
					},
				}
			: null,
		displayName: profile
			? `${profile.firstName} ${profile.lastName}`.trim()
			: account.loginIdentifier,
	};
}

async function createSession(db: Database, accountId: string) {
	const token = randomToken(32);
	const now = new Date();
	const expiresAt = new Date(now.getTime() + SESSION_IDLE_MS);
	const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_MS);
	await db.insert(sessions).values({
		id: crypto.randomUUID(),
		accountId,
		tokenHash: await hashSecret(token),
		createdAt: now,
		expiresAt,
		lastSeenAt: now,
		absoluteExpiresAt,
	});
	return {
		token,
		cookieHeader: sessionCookieHeader(token, Math.floor(SESSION_IDLE_MS / 1000)),
	};
}

function normalizeCode(code: string): string {
	return code.trim().toUpperCase();
}

export function inviteExpiresAt(from = new Date()): Date {
	return new Date(from.getTime() + INVITE_TTL_MS);
}

export async function createInviteRecord(
	db: Database,
	input: {
		accountId: string;
		createdByAccountId: string;
	},
) {
	const code = formatCode();
	const now = new Date();
	await db.insert(invites).values({
		id: crypto.randomUUID(),
		accountId: input.accountId,
		codeHash: await hashSecret(normalizeCode(code)),
		createdByAccountId: input.createdByAccountId,
		expiresAt: inviteExpiresAt(now),
		createdAt: now,
	});
	return code;
}

export function sessionSecretForEnv(env: Env): string {
	return requireSessionSecret(env);
}
