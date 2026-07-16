import { eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import { accounts, domains, mailboxes } from "../../db/schema";
import type { Principal } from "../auth/types";
import { loadBlackholeMailboxForDomain } from "../mailbox-queries";
import type { OutboundContext } from "../messages/outbound-context";
import { sendAndPersistNewMessage } from "../messages/outbound-persist";
import { sendEmail } from "../messages/send-email";
import { buildEmailAddress } from "../normalize-email-address";
import { SYSTEM_BLACKHOLE_LOCAL_PART } from "../system-mailboxes";
import { getInstanceSettings } from "../../services/instance-settings";

export type TransactionalEmailDeps = {
	email: SendEmail;
	bucket: R2Bucket;
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
	input: { domainName: string; to: string; subject: string; text: string },
): Promise<void> {
	const settings = await getInstanceSettings(db);

	if (settings.persistNoreplyOutboundEmails) {
		const mailbox = await loadBlackholeMailboxForDomain(db, input.domainName);
		if (mailbox) {
			const ctx: OutboundContext = {
				db,
				bucket: deps.bucket,
				email: deps.email,
				principal: SYSTEM_OUTBOUND_PRINCIPAL,
			};

			await sendAndPersistNewMessage(
				ctx,
				mailbox.id,
				{
					to: [input.to],
					subject: input.subject,
					text: input.text,
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
