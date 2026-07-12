import { assertMailboxReadAccess } from "../../lib/messages/mailbox-read-auth";
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
	await assertMailboxReadAccess(ctx, mailboxId);
	return listLabels(ctx.db, mailboxId);
}

export async function readCreateLabel(
	ctx: MailboxReadContext,
	mailboxId: string,
	input: { name: string; color: string | null },
) {
	await assertMailboxReadAccess(ctx, mailboxId);
	return createLabel(ctx.db, mailboxId, input);
}

export async function readGetLabel(
	ctx: MailboxReadContext,
	mailboxId: string,
	labelId: string,
) {
	await assertMailboxReadAccess(ctx, mailboxId);
	return getLabel(ctx.db, mailboxId, labelId);
}

export async function readUpdateLabel(
	ctx: MailboxReadContext,
	mailboxId: string,
	labelId: string,
	input: { name?: string; color?: string | null },
) {
	await assertMailboxReadAccess(ctx, mailboxId);
	return updateLabel(ctx.db, mailboxId, labelId, input);
}

export async function readRemoveLabel(
	ctx: MailboxReadContext,
	mailboxId: string,
	labelId: string,
) {
	await assertMailboxReadAccess(ctx, mailboxId);
	await removeLabel(ctx.db, mailboxId, labelId);
}
