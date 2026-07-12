import type { ThreadAction, ThreadFolder } from "../../lib/mailbox-types";
import {
	createMailboxReadContext,
	type MailboxReadContext,
} from "../../lib/messages/mailbox-read-context";
import {
	readCreateLabel,
	readGetLabel,
	readListLabels,
	readRemoveLabel,
	readUpdateLabel,
} from "./labels";
import {
	readDownloadRawMessage,
	readGetMessage,
	readGetMessagePreview,
	readSearchMessages,
} from "./messages";
import {
	readGetThread,
	readListThreadMessages,
	readListThreads,
	readReplaceThreadLabels,
	readRunThreadAction,
} from "./threads";

export type MailboxMailContext = MailboxReadContext;
export { createMailboxReadContext };

/**
 * Deep read module: threads, messages, labels, and search behind one interface.
 * Context is bound at construction — callers pass intents only.
 */
export class MailboxMail {
	constructor(private readonly ctx: MailboxReadContext) {}

	listThreads(
		mailboxId: string,
		options: {
			folder: ThreadFolder | null;
			labelId: string | null;
			cursor: string | null;
			limit: number;
		},
	) {
		return readListThreads(this.ctx, mailboxId, options);
	}

	getThread(threadId: string, mailboxId: string) {
		return readGetThread(this.ctx, threadId, mailboxId);
	}

	listThreadMessages(
		threadId: string,
		mailboxId: string,
		options: { includeBody: boolean },
	) {
		return readListThreadMessages(this.ctx, threadId, mailboxId, options);
	}

	runThreadAction(threadId: string, mailboxId: string, action: ThreadAction) {
		return readRunThreadAction(this.ctx, threadId, mailboxId, action);
	}

	replaceThreadLabels(threadId: string, mailboxId: string, labelIds: string[]) {
		return readReplaceThreadLabels(this.ctx, threadId, mailboxId, labelIds);
	}

	getMessage(messageId: string, mailboxId: string) {
		return readGetMessage(this.ctx, messageId, mailboxId);
	}

	getMessagePreview(messageId: string, mailboxId: string) {
		return readGetMessagePreview(this.ctx, messageId, mailboxId);
	}

	search(
		mailboxId: string,
		query: string,
		options: { cursor: string | null; limit: number },
	) {
		return readSearchMessages(this.ctx, mailboxId, query, options);
	}

	downloadRawMessage(messageId: string, mailboxId: string) {
		return readDownloadRawMessage(this.ctx, messageId, mailboxId);
	}

	listLabels(mailboxId: string) {
		return readListLabels(this.ctx, mailboxId);
	}

	createLabel(
		mailboxId: string,
		input: { name: string; color: string | null },
	) {
		return readCreateLabel(this.ctx, mailboxId, input);
	}

	getLabel(mailboxId: string, labelId: string) {
		return readGetLabel(this.ctx, mailboxId, labelId);
	}

	updateLabel(
		mailboxId: string,
		labelId: string,
		input: { name?: string; color?: string | null },
	) {
		return readUpdateLabel(this.ctx, mailboxId, labelId, input);
	}

	removeLabel(mailboxId: string, labelId: string) {
		return readRemoveLabel(this.ctx, mailboxId, labelId);
	}
}

export function createMailboxMail(ctx: MailboxReadContext): MailboxMail {
	return new MailboxMail(ctx);
}
