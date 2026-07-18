import type { ThreadAction, ThreadFolder } from "../../lib/mailbox-types";
import { authorizeMailbox } from "../../lib/auth/access";
import {
	createMailboxReadContext,
	type MailboxReadContext,
} from "../../lib/messages/mailbox-read-context";
import { markThreadMessagesSeenBy } from "../../lib/message-seen-by";
import {
	createLabel,
	getLabel,
	listLabels,
	removeLabel,
	updateLabel,
} from "../labels";
import { emitLog } from "../logs";
import { downloadRawMessage } from "../raw-message";
import { runThreadAction } from "../thread-commands";
import {
	getThread,
	listThreadMessages,
	listThreads,
	readMessageFull,
	readMessagePreview,
	replaceThreadLabels,
	searchMessages,
} from "../threads";

export type MailboxMailContext = MailboxReadContext;
export { createMailboxReadContext };

/**
 * Deep read module: threads, messages, labels, and search behind one interface.
 * Context is bound at construction — callers pass intents only.
 */
export class MailboxMail {
	constructor(private readonly ctx: MailboxReadContext) {}

	private authorizeRead(mailboxId: string) {
		return authorizeMailbox(this.ctx.db, this.ctx.principal, mailboxId, "read");
	}

	async listThreads(
		mailboxId: string,
		options: {
			folder: ThreadFolder | null;
			labelId: string | null;
			cursor: string | null;
			limit: number;
		},
	) {
		await this.authorizeRead(mailboxId);
		return listThreads(this.ctx.db, mailboxId, options);
	}

	async getThread(threadId: string, mailboxId: string) {
		await this.authorizeRead(mailboxId);
		await markThreadMessagesSeenBy(this.ctx.db, this.ctx.principal, {
			threadId,
			mailboxId,
		});

		const accountId = this.ctx.principal.accountId;
		if (accountId) {
			try {
				await emitLog(this.ctx.db, {
					importance: 10,
					type: "threads",
					summary: "{actor} viewed {thread}",
					refs: {
						actor: { kind: "account", id: accountId },
						thread: { kind: "thread", id: threadId },
						mailbox: { kind: "mailbox", id: mailboxId },
					},
					actorAccountId: accountId,
					context: this.ctx.logContext ?? null,
				});
			} catch (error) {
				console.error("Failed to emit thread view log:", error);
			}
		}

		return getThread(this.ctx.db, threadId, mailboxId);
	}

	async listThreadMessages(
		threadId: string,
		mailboxId: string,
		options: { includeBody: boolean },
	) {
		await this.authorizeRead(mailboxId);
		await markThreadMessagesSeenBy(this.ctx.db, this.ctx.principal, {
			threadId,
			mailboxId,
		});
		return listThreadMessages(this.ctx.db, threadId, mailboxId, {
			bucket: options.includeBody ? this.ctx.bucket : undefined,
			includeBody: options.includeBody,
		});
	}

	async runThreadAction(
		threadId: string,
		mailboxId: string,
		action: ThreadAction,
	) {
		await this.authorizeRead(mailboxId);
		await getThread(this.ctx.db, threadId, mailboxId);
		await runThreadAction(this.ctx.db, threadId, mailboxId, action);

		if (action === "mark-read") {
			const accountId = this.ctx.principal.accountId;
			if (accountId) {
				try {
					await emitLog(this.ctx.db, {
						importance: 10,
						type: "threads",
						summary: "{actor} marked {thread} read",
						refs: {
							actor: { kind: "account", id: accountId },
							thread: { kind: "thread", id: threadId },
							mailbox: { kind: "mailbox", id: mailboxId },
						},
						actorAccountId: accountId,
						context: this.ctx.logContext ?? null,
					});
				} catch (error) {
					console.error("Failed to emit thread mark-read log:", error);
				}
			}
		}

		return getThread(this.ctx.db, threadId, mailboxId);
	}

	async replaceThreadLabels(
		threadId: string,
		mailboxId: string,
		labelIds: string[],
	) {
		await this.authorizeRead(mailboxId);
		return replaceThreadLabels(this.ctx.db, threadId, mailboxId, labelIds);
	}

	async getMessage(messageId: string, mailboxId: string) {
		await this.authorizeRead(mailboxId);
		const message = await readMessageFull(
			this.ctx.db,
			this.ctx.bucket,
			messageId,
			mailboxId,
		);

		const accountId = this.ctx.principal.accountId;
		if (accountId) {
			try {
				await emitLog(this.ctx.db, {
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
					context: this.ctx.logContext ?? null,
				});
			} catch (error) {
				console.error("Failed to emit message read log:", error);
			}
		}

		return message;
	}

	async getMessagePreview(messageId: string, mailboxId: string) {
		await this.authorizeRead(mailboxId);
		return readMessagePreview(this.ctx.db, messageId, mailboxId);
	}

	async search(
		mailboxId: string,
		query: string,
		options: { cursor: string | null; limit: number },
	) {
		await this.authorizeRead(mailboxId);
		return searchMessages(this.ctx.db, mailboxId, query, options);
	}

	async downloadRawMessage(messageId: string, mailboxId: string) {
		await this.authorizeRead(mailboxId);
		return downloadRawMessage(
			this.ctx.db,
			this.ctx.bucket,
			messageId,
			mailboxId,
		);
	}

	async listLabels(mailboxId: string) {
		await this.authorizeRead(mailboxId);
		return listLabels(this.ctx.db, mailboxId);
	}

	async createLabel(
		mailboxId: string,
		input: { name: string; color: string | null },
	) {
		await this.authorizeRead(mailboxId);
		return createLabel(this.ctx.db, mailboxId, input);
	}

	async getLabel(mailboxId: string, labelId: string) {
		await this.authorizeRead(mailboxId);
		return getLabel(this.ctx.db, mailboxId, labelId);
	}

	async updateLabel(
		mailboxId: string,
		labelId: string,
		input: { name?: string; color?: string | null },
	) {
		await this.authorizeRead(mailboxId);
		return updateLabel(this.ctx.db, mailboxId, labelId, input);
	}

	async removeLabel(mailboxId: string, labelId: string) {
		await this.authorizeRead(mailboxId);
		await removeLabel(this.ctx.db, mailboxId, labelId);
	}
}

export function createMailboxMail(ctx: MailboxReadContext): MailboxMail {
	return new MailboxMail(ctx);
}
