import { assertMailboxReadAccess } from "../../lib/messages/mailbox-read-auth";
import type { MailboxReadContext } from "../../lib/messages/mailbox-read-context";
import { downloadRawMessage } from "../raw-message";
import {
	readMessageFull,
	readMessagePreview,
	searchMessages,
} from "../threads";

export async function readGetMessage(
	ctx: MailboxReadContext,
	messageId: string,
	mailboxId: string,
) {
	await assertMailboxReadAccess(ctx, mailboxId);
	return readMessageFull(ctx.db, ctx.bucket, messageId, mailboxId);
}

export async function readGetMessagePreview(
	ctx: MailboxReadContext,
	messageId: string,
	mailboxId: string,
) {
	await assertMailboxReadAccess(ctx, mailboxId);
	return readMessagePreview(ctx.db, messageId, mailboxId);
}

export async function readSearchMessages(
	ctx: MailboxReadContext,
	mailboxId: string,
	query: string,
	options: { cursor: string | null; limit: number },
) {
	await assertMailboxReadAccess(ctx, mailboxId);
	return searchMessages(ctx.db, mailboxId, query, options);
}

export async function readDownloadRawMessage(
	ctx: MailboxReadContext,
	messageId: string,
	mailboxId: string,
) {
	await assertMailboxReadAccess(ctx, mailboxId);
	return downloadRawMessage(ctx.db, ctx.bucket, messageId, mailboxId);
}
