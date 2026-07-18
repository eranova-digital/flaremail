import { eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import { accounts, domains, mailboxes } from "../../db/schema";
import {
	inviteTemplateValues,
	loadSystemEmailHtml,
	mfaDisableTemplateValues,
	passwordResetTemplateValues,
	recoveryVerifyTemplateValues,
} from "../email-templates/system-html";
import { getPersistNoreplyOutboundEmails } from "../instance-settings/read";
import type { Principal } from "../auth/types";
import { loadBlackholeMailboxForDomain } from "../mailbox-queries";
import type {
	OutboundContext,
	ResolveIdentityForSend,
} from "../messages/outbound-context";
import { sendAndPersistNewMessage } from "../messages/outbound-persist";
import { sendEmail } from "../messages/send-email";
import { buildEmailAddress } from "../normalize-email-address";
import { SYSTEM_BLACKHOLE_LOCAL_PART } from "../system-mailboxes";
import type { SystemEmailTemplateKey } from "../email-templates/system-catalog";

export type TransactionalEmailDeps = {
	email: SendEmail;
	bucket: R2Bucket;
	resolveIdentityForSend: ResolveIdentityForSend;
};

const SYSTEM_OUTBOUND_PRINCIPAL: Principal = {
	kind: "session",
	accountId: null,
	isIntendant: true,
	role: null,
	status: null,
	loginIdentifier: null,
	primaryMailboxId: null,
	domainIds: [],
	grantMailboxIds: [],
	sharedMailboxAssignment: [],
};

export async function resolveAccountSenderDomain(
	db: Database,
	accountId: string,
): Promise<string | null> {
	const [row] = await db
		.select({ domainName: domains.name })
		.from(accounts)
		.leftJoin(mailboxes, eq(mailboxes.id, accounts.primaryMailboxId))
		.leftJoin(domains, eq(domains.id, mailboxes.domainId))
		.where(eq(accounts.id, accountId))
		.limit(1);

	return row?.domainName ?? null;
}

export async function resolveDomainName(
	db: Database,
	domainId: string,
): Promise<string | null> {
	const [row] = await db
		.select({ name: domains.name })
		.from(domains)
		.where(eq(domains.id, domainId))
		.limit(1);

	return row?.name ?? null;
}

export async function sendTransactionalEmail(
	db: Database,
	deps: TransactionalEmailDeps,
	input: {
		domainName: string;
		to: string;
		subject: string;
		text: string;
		html?: string;
	},
): Promise<void> {
	const persistNoreplyOutboundEmails = await getPersistNoreplyOutboundEmails(db);

	if (persistNoreplyOutboundEmails) {
		const mailbox = await loadBlackholeMailboxForDomain(db, input.domainName);
		if (mailbox) {
			const ctx: OutboundContext = {
				db,
				bucket: deps.bucket,
				email: deps.email,
				principal: SYSTEM_OUTBOUND_PRINCIPAL,
				resolveIdentityForSend: deps.resolveIdentityForSend,
			};

			await sendAndPersistNewMessage(
				ctx,
				mailbox.id,
				{
					to: [input.to],
					subject: input.subject,
					text: input.text,
					html: input.html,
				},
				{
					threadId: crypto.randomUUID(),
					inReplyTo: null,
					references: null,
					isReply: false,
				},
				"sent",
			);
			return;
		}
	}

	const from = buildEmailAddress(SYSTEM_BLACKHOLE_LOCAL_PART, input.domainName);
	await sendEmail(deps.email, {
		from,
		to: input.to,
		subject: input.subject,
		text: input.text,
		html: input.html,
	});
}

export function inviteCodeEmailText(code: string): string {
	return [
		"Your Flaremail invite code",
		"",
		`Use this code to activate your account: ${code}`,
		"",
		"This code expires in 7 days.",
	].join("\n");
}

export function passwordResetCodeEmailText(code: string): string {
	return [
		"Your Flaremail password reset code",
		"",
		`Use this code to reset your password: ${code}`,
		"",
		"This code expires in 24 hours.",
	].join("\n");
}

export function recoveryEmailVerificationText(code: string): string {
	return [
		"Verify your Flaremail recovery email",
		"",
		`Your verification code is: ${code}`,
		"",
		"This code expires in 15 minutes.",
	].join("\n");
}

export function mfaDisableRecoveryCodeText(code: string): string {
	return [
		"Disable two-factor authentication on your Flaremail account",
		"",
		`Your verification code is: ${code}`,
		"",
		"This code expires in 15 minutes.",
	].join("\n");
}

async function resolveHtml(
	db: Database,
	bucket: R2Bucket,
	key: SystemEmailTemplateKey,
	values: Record<string, string>,
): Promise<string | undefined> {
	return loadSystemEmailHtml(db, bucket, key, values);
}

export async function sendInviteTransactionalEmail(
	db: Database,
	deps: TransactionalEmailDeps,
	input: { domainName: string; to: string; code: string },
): Promise<void> {
	const values = inviteTemplateValues(input.code);
	const html = await resolveHtml(db, deps.bucket, "invite", values);
	await sendTransactionalEmail(db, deps, {
		domainName: input.domainName,
		to: input.to,
		subject: "Your Flaremail invite code",
		text: inviteCodeEmailText(input.code),
		html,
	});
}

export async function sendPasswordResetTransactionalEmail(
	db: Database,
	deps: TransactionalEmailDeps,
	input: { domainName: string; to: string; code: string },
): Promise<void> {
	const values = passwordResetTemplateValues(input.code);
	const html = await resolveHtml(db, deps.bucket, "password_reset", values);
	await sendTransactionalEmail(db, deps, {
		domainName: input.domainName,
		to: input.to,
		subject: "Reset your Flaremail password",
		text: passwordResetCodeEmailText(input.code),
		html,
	});
}

export async function sendRecoveryVerifyTransactionalEmail(
	db: Database,
	deps: TransactionalEmailDeps,
	input: { domainName: string; to: string; code: string },
): Promise<void> {
	const values = recoveryVerifyTemplateValues(input.code);
	const html = await resolveHtml(db, deps.bucket, "recovery_verify", values);
	await sendTransactionalEmail(db, deps, {
		domainName: input.domainName,
		to: input.to,
		subject: "Verify your Flaremail recovery email",
		text: recoveryEmailVerificationText(input.code),
		html,
	});
}

export async function sendMfaDisableTransactionalEmail(
	db: Database,
	deps: TransactionalEmailDeps,
	input: { domainName: string; to: string; code: string },
): Promise<void> {
	const values = mfaDisableTemplateValues(input.code);
	const html = await resolveHtml(db, deps.bucket, "mfa_disable", values);
	await sendTransactionalEmail(db, deps, {
		domainName: input.domainName,
		to: input.to,
		subject: "Disable two-factor authentication on your Flaremail account",
		text: mfaDisableRecoveryCodeText(input.code),
		html,
	});
}
