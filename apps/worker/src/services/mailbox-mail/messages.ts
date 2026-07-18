import { assertMailboxReadAccess } from "../../lib/messages/mailbox-read-auth";
import type { MailboxReadContext } from "../../lib/messages/mailbox-read-context";
import { emitLog } from "../logs";
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
	const message = await readMessageFull(
		ctx.db,
		ctx.bucket,
		messageId,
		mailboxId,
	);

	const accountId = ctx.principal.accountId;
	if (accountId) {
		try {
			await emitLog(ctx.db, {
				importance: 9,
				type: "messages",
				summary: "{actor} read {message}",
				refs: {
					actor: { kind: "account", id: accountId },
					message: { kind: "message", id: message.id },
					thread: { kind: "thread", id: message.threadId },
					mailbox: { kind: "mailbox", id: mailboxId },
				},
				actorAccountId: accountId,
				context: ctx.logContext ?? null,
			});
		} catch (error) {
			console.error("Failed to emit message read log:", error);
		}
	}

	return message;
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
