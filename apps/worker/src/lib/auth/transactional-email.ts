import { eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import { accounts, domains, mailboxes } from "../../db/schema";
import { sendEmail } from "../messages/send-email";
import { buildEmailAddress } from "../normalize-email-address";
import { SYSTEM_BLACKHOLE_LOCAL_PART } from "../system-mailboxes";

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
	email: SendEmail,
	input: { domainName: string; to: string; subject: string; text: string },
): Promise<void> {
	const from = buildEmailAddress(SYSTEM_BLACKHOLE_LOCAL_PART, input.domainName);
	await sendEmail(email, {
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
