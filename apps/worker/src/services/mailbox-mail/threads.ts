import type { ThreadAction, ThreadFolder } from "../../lib/mailbox-types";
import { authorizeMailbox } from "../../lib/auth/access";
import type { MailboxReadContext } from "../../lib/messages/mailbox-read-context";
import { markThreadMessagesSeenBy } from "../../lib/message-seen-by";
import { emitLog } from "../logs";
import { runThreadAction } from "../thread-commands";
import {
	getThread,
	listThreadMessages,
	listThreads,
	replaceThreadLabels,
} from "../threads";

export async function readListThreads(
	ctx: MailboxReadContext,
	mailboxId: string,
	options: {
		folder: ThreadFolder | null;
		labelId: string | null;
		cursor: string | null;
		limit: number;
	},
) {
	await authorizeMailbox(ctx.db, ctx.principal, mailboxId, "read");
	return listThreads(ctx.db, mailboxId, options);
}

export async function readGetThread(
	ctx: MailboxReadContext,
	threadId: string,
	mailboxId: string,
) {
	await authorizeMailbox(ctx.db, ctx.principal, mailboxId, "read");
	await markThreadMessagesSeenBy(ctx.db, ctx.principal, { threadId, mailboxId });

	const accountId = ctx.principal.accountId;
	if (accountId) {
		try {
			await emitLog(ctx.db, {
				importance: 10,
				type: "threads",
				summary: "{actor} viewed {thread}",
				refs: {
					actor: { kind: "account", id: accountId },
					thread: { kind: "thread", id: threadId },
					mailbox: { kind: "mailbox", id: mailboxId },
				},
				actorAccountId: accountId,
				context: ctx.logContext ?? null,
			});
		} catch (error) {
			console.error("Failed to emit thread view log:", error);
		}
	}

	return getThread(ctx.db, threadId, mailboxId);
}

export async function readListThreadMessages(
	ctx: MailboxReadContext,
	threadId: string,
	mailboxId: string,
	options: { includeBody: boolean },
) {
	await authorizeMailbox(ctx.db, ctx.principal, mailboxId, "read");
	await markThreadMessagesSeenBy(ctx.db, ctx.principal, { threadId, mailboxId });
	return listThreadMessages(ctx.db, threadId, mailboxId, {
		bucket: options.includeBody ? ctx.bucket : undefined,
		includeBody: options.includeBody,
	});
}

export async function readRunThreadAction(
	ctx: MailboxReadContext,
	threadId: string,
	mailboxId: string,
	action: ThreadAction,
) {
	await authorizeMailbox(ctx.db, ctx.principal, mailboxId, "read");
	await getThread(ctx.db, threadId, mailboxId);
	await runThreadAction(ctx.db, threadId, mailboxId, action);

	if (action === "mark-read") {
		const accountId = ctx.principal.accountId;
		if (accountId) {
			try {
				await emitLog(ctx.db, {
					importance: 10,
					type: "threads",
					summary: "{actor} marked {thread} read",
					refs: {
						actor: { kind: "account", id: accountId },
						thread: { kind: "thread", id: threadId },
						mailbox: { kind: "mailbox", id: mailboxId },
					},
					actorAccountId: accountId,
					context: ctx.logContext ?? null,
				});
			} catch (error) {
				console.error("Failed to emit thread mark-read log:", error);
			}
		}
	}

	return getThread(ctx.db, threadId, mailboxId);
}

export async function readReplaceThreadLabels(
	ctx: MailboxReadContext,
	threadId: string,
	mailboxId: string,
	labelIds: string[],
) {
	await authorizeMailbox(ctx.db, ctx.principal, mailboxId, "read");
	return replaceThreadLabels(ctx.db, threadId, mailboxId, labelIds);
}
