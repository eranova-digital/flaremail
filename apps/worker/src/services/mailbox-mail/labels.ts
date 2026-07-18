import { authorizeMailbox } from "../../lib/auth/access";
import type { MailboxReadContext } from "../../lib/messages/mailbox-read-context";
import {
	createLabel,
	getLabel,
	listLabels,
	removeLabel,
	updateLabel,
} from "../labels";

export async function readListLabels(
	ctx: MailboxReadContext,
	mailboxId: string,
) {
	await authorizeMailbox(ctx.db, ctx.principal, mailboxId, "read");
	return listLabels(ctx.db, mailboxId);
}

export async function readCreateLabel(
	ctx: MailboxReadContext,
	mailboxId: string,
	input: { name: string; color: string | null },
) {
	await authorizeMailbox(ctx.db, ctx.principal, mailboxId, "read");
	return createLabel(ctx.db, mailboxId, input);
}

export async function readGetLabel(
	ctx: MailboxReadContext,
	mailboxId: string,
	labelId: string,
) {
	await authorizeMailbox(ctx.db, ctx.principal, mailboxId, "read");
	return getLabel(ctx.db, mailboxId, labelId);
}

export async function readUpdateLabel(
	ctx: MailboxReadContext,
	mailboxId: string,
	labelId: string,
	input: { name?: string; color?: string | null },
) {
	await authorizeMailbox(ctx.db, ctx.principal, mailboxId, "read");
	return updateLabel(ctx.db, mailboxId, labelId, input);
}

export async function readRemoveLabel(
	ctx: MailboxReadContext,
	mailboxId: string,
	labelId: string,
) {
	await authorizeMailbox(ctx.db, ctx.principal, mailboxId, "read");
	await removeLabel(ctx.db, mailboxId, labelId);
}
