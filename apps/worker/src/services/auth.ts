import { and, eq, gt } from "drizzle-orm";

import type { Database } from "../db/client";
import {
	accountDomainAssignments,
	accountProfiles,
	accounts,
	invites,
	mailboxes,
	passwordResetCodes,
	profileFieldLocks,
} from "../db/schema";
import { formatCode, randomToken } from "../lib/auth/crypto";
import { hashPassword, hashSecret, verifyPassword } from "../lib/auth/password";
import { loadAccountProfile } from "../lib/auth/principal";
import { requireSessionSecret } from "../lib/auth/resolve-principal";
import {
	passwordResetCodeEmailText,
	resolveAccountSenderDomain,
	sendTransactionalEmail,
	type TransactionalEmailDeps,
} from "../lib/auth/transactional-email";
import {
	loadProfileLocks,
	type AccountProfileInput,
	type ProfileLockableField,
} from "./accounts";
import { createSession, signOutSession, type SessionMetadata } from "./auth-session";
import {
	createMfaChallengeToken,
	getMfaStatus,
	isMfaEnabled,
} from "./mfa";
import { getInstanceSettings } from "./instance-settings";
import { computeAccountCapabilities } from "./account-capabilities";
import { getSecurityRequirements, getOrganizationPolicies } from "./security-compliance";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 24 * 60 * 60 * 1000;

export class NoRecoveryEmailError extends Error {
	constructor() {
		super(
			"You haven't configured a recovery email. Please ask a supervisor for a recovery code.",
		);
		this.name = "NoRecoveryEmailError";
	}
}

export async function signIn(
	db: Database,
	input: { loginIdentifier: string; password: string },
	encryptionKey: string,
	sessionMetadata?: SessionMetadata,
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

	if (await isMfaEnabled(db, account.id)) {
		return {
			requiresMfa: true as const,
			mfaToken: await createMfaChallengeToken(account.id, encryptionKey),
		};
	}

	return {
		requiresMfa: false as const,
		...(await createSession(db, account.id, sessionMetadata)),
	};
}

export async function previewInvite(db: Database, code: string) {
	const codeHash = await hashSecret(normalizeCode(code));
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

	const profile = await loadAccountProfile(db, account.id);
	const lockedFields = await loadProfileLocks(db, account.id);
	const settings = await getInstanceSettings(db);

	let address = account.loginIdentifier;
	if (account.primaryMailboxId) {
		const [mailbox] = await db
			.select({ address: mailboxes.address })
			.from(mailboxes)
			.where(eq(mailboxes.id, account.primaryMailboxId))
			.limit(1);
		if (mailbox?.address) {
			address = mailbox.address;
		}
	}

	return {
		address,
		lockedFields,
		requireRecoveryEmail: settings.requireRecoveryEmail,
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
	};
}

export async function activateInvite(
	db: Database,
	input: {
		code: string;
		password: string;
		profile?: AccountProfileInput;
	},
	sessionMetadata?: SessionMetadata,
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

	const existingProfile = await loadAccountProfile(db, account.id);
	const lockedFields = new Set(await loadProfileLocks(db, account.id));

	if (input.profile && existingProfile) {
		const patch = buildActivationProfilePatch(
			input.profile,
			existingProfile,
			lockedFields,
		);
		if (Object.keys(patch).length > 0) {
			await db
				.update(accountProfiles)
				.set({ ...patch, updatedAt: now })
				.where(eq(accountProfiles.accountId, account.id));
		}
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

	await db
		.update(invites)
		.set({ usedAt: now })
		.where(eq(invites.id, invite.id));

	return createSession(db, account.id, sessionMetadata);
}

export async function signOut(db: Database, sessionToken: string) {
	return signOutSession(db, sessionToken);
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

export async function requestPasswordReset(
	db: Database,
	deps: TransactionalEmailDeps,
	input: { address: string },
) {
	const address = input.address.trim().toLowerCase();
	if (!address) {
		throw new Error("Mailbox address is required");
	}

	let [account] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.loginIdentifier, address))
		.limit(1);

	if (!account) {
		const [mailbox] = await db
			.select({ id: mailboxes.id })
			.from(mailboxes)
			.where(eq(mailboxes.address, address))
			.limit(1);
		if (mailbox) {
			[account] = await db
				.select()
				.from(accounts)
				.where(eq(accounts.primaryMailboxId, mailbox.id))
				.limit(1);
		}
	}

	if (!account) {
		throw new Error("No account found with that address");
	}
	if (account.status === "pending") {
		throw new Error("This account has not been activated yet");
	}
	if (account.status === "suspended") {
		throw new Error("Account is suspended");
	}

	const profile = await loadAccountProfile(db, account.id);
	const recoveryAddress = profile?.recoveryAddress?.trim();
	if (!recoveryAddress) {
		throw new NoRecoveryEmailError();
	}

	const code = await createPasswordResetCode(db, {
		accountId: account.id,
		createdByAccountId: account.id,
	});

	const domainName = await resolveAccountSenderDomain(db, account.id);
	if (!domainName) {
		throw new Error("Could not determine sender domain for this account");
	}

	await sendTransactionalEmail(db, deps, {
		domainName,
		to: recoveryAddress,
		subject: "Reset your Flaremail password",
		text: passwordResetCodeEmailText(code),
	});

	return { ok: true as const };
}

export async function previewPasswordReset(db: Database, code: string) {
	const codeHash = await hashSecret(normalizeCode(code));
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

	const [account] = await db
		.select()
		.from(accounts)
		.where(eq(accounts.id, row.accountId))
		.limit(1);
	if (!account) {
		throw new Error("Invalid or expired reset code");
	}

	let address = account.loginIdentifier;
	if (account.primaryMailboxId) {
		const [mailbox] = await db
			.select({ address: mailboxes.address })
			.from(mailboxes)
			.where(eq(mailboxes.id, account.primaryMailboxId))
			.limit(1);
		if (mailbox?.address) {
			address = mailbox.address;
		}
	}

	return { address };
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
	const domainRows = await db
		.select({ domainId: accountDomainAssignments.domainId })
		.from(accountDomainAssignments)
		.where(eq(accountDomainAssignments.accountId, accountId));
	const mfa = await getMfaStatus(db, accountId);
	const settings = await getInstanceSettings(db);
	const profilePayload = profile
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
		: null;
	const securityRequirements = getSecurityRequirements(
		{
			isIntendant: account.isIntendant,
			role: account.role,
			profile: profilePayload,
			mfaEnabled: mfa.enabled,
		},
		settings,
	);
	const organizationPolicies = getOrganizationPolicies(
		{
			isIntendant: account.isIntendant,
			role: account.role,
		},
		settings,
	);
	const capabilities = computeAccountCapabilities(
		{
			isIntendant: account.isIntendant,
			role: account.role,
		},
		settings,
	);

	return {
		id: account.id,
		isIntendant: account.isIntendant,
		role: account.role,
		status: account.status,
		loginIdentifier: account.loginIdentifier,
		primaryMailboxId: account.primaryMailboxId,
		domainIds: domainRows.map((row) => row.domainId),
		lockedFields: lockedRows.map((row) => row.fieldName),
		mfaEnabled: mfa.enabled,
		mfaEnabledAt: mfa.enabledAt,
		securityRequirements,
		organizationPolicies,
		capabilities,
		profile: profilePayload,
		displayName: profile
			? `${profile.firstName} ${profile.lastName}`.trim()
			: account.loginIdentifier,
	};
}

export { createSession } from "./auth-session";

function normalizeCode(code: string): string {
	return code.trim().toUpperCase();
}

function buildActivationProfilePatch(
	input: AccountProfileInput,
	existing: NonNullable<Awaited<ReturnType<typeof loadAccountProfile>>>,
	lockedFields: Set<string>,
): Record<string, string | null> {
	const patch: Record<string, string | null> = {};
	const entries: [ProfileLockableField, string | null | undefined][] = [
		["firstName", input.firstName],
		["lastName", input.lastName],
		["recoveryAddress", input.recoveryAddress],
		["phone", input.phone],
		["addressCountry", input.addressCountry],
		["addressState", input.addressState],
		["addressCity", input.addressCity],
		["addressLine1", input.addressLine1],
		["addressLine2", input.addressLine2],
	];

	for (const [field, value] of entries) {
		if (value === undefined) {
			continue;
		}
		const existingValue = existing[field] ?? null;
		if (lockedFields.has(field)) {
			if (value !== existingValue) {
				throw new Error(`Field '${field}' is locked and cannot be changed`);
			}
			continue;
		}
		patch[field] = value;
	}

	return patch;
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
