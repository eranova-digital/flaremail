import type { ThreadAction, ThreadFolder } from "../../lib/mailbox-types";
import { assertMailboxReadAccess } from "../../lib/messages/mailbox-read-auth";
import type { MailboxReadContext } from "../../lib/messages/mailbox-read-context";
import { markThreadSeenBy } from "../../lib/thread-seen-by";
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
	await assertMailboxReadAccess(ctx, mailboxId);
	return listThreads(ctx.db, mailboxId, options);
}

export async function readGetThread(
	ctx: MailboxReadContext,
	threadId: string,
	mailboxId: string,
) {
	await assertMailboxReadAccess(ctx, mailboxId);
	await markThreadSeenBy(ctx.db, ctx.principal, { threadId, mailboxId });
	return getThread(ctx.db, threadId, mailboxId);
}

export async function readListThreadMessages(
	ctx: MailboxReadContext,
	threadId: string,
	mailboxId: string,
	options: { includeBody: boolean },
) {
	await assertMailboxReadAccess(ctx, mailboxId);
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
	await assertMailboxReadAccess(ctx, mailboxId);
	await getThread(ctx.db, threadId, mailboxId);
	await runThreadAction(ctx.db, threadId, mailboxId, action);
	return getThread(ctx.db, threadId, mailboxId);
}

export async function readReplaceThreadLabels(
	ctx: MailboxReadContext,
	threadId: string,
	mailboxId: string,
	labelIds: string[],
) {
	await assertMailboxReadAccess(ctx, mailboxId);
	return replaceThreadLabels(ctx.db, threadId, mailboxId, labelIds);
}
