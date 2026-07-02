import { and, eq } from "drizzle-orm";
import PostalMime from "postal-mime";

import type { Database } from "../../db/client";
import { attachments, messages, threadMailboxes, threads } from "../../db/schema";
import { assertCanSendFrom } from "../authorize-mailbox";
import { findMessageRowByRfcMessageId } from "../find-message";
import {
	assertMessageVisibleInMailbox,
	findThreadMailbox,
	linkMessageMailboxes,
	refreshThreadMailboxStats,
} from "../message-mailboxes";
import { loadMailboxForSend } from "../mailbox-queries";
import { deleteR2Objects } from "../r2-cleanup";
import {
	finalizeThreadOnOutboundSend,
	refreshThreadAfterDraftDelete,
} from "../touch-thread-outbound";
import {
	deleteThreadIfEmpty,
	prepareThreadForMessage,
	type ThreadFolder,
	type ThreadTouchData,
} from "../touch-thread";
import { buildReplyThreading } from "./build-reply-threading";
import {
	buildForwardBodyHtml,
	buildForwardBodyText,
	buildForwardQuotedHtml,
	buildForwardQuotedText,
	forwardSubject,
} from "./build-forward-content";
import {
	buildEmailSendPayload,
	buildOutboundMimeContent,
} from "./build-outbound-mime";
import { generateMessageId, canonicalizeSentMessageId } from "./message-id";
import {
	findDraftById,
	findMessageById,
	findThreadById,
} from "./message-queries";
import { buildPreview } from "./message-utils";
import { outboundAttachmentsToStoredInputs, loadDraftOutboundPayload, loadStoredAttachmentInputs, storedInputsToOutboundAttachments, type OutboundAttachmentInput } from "./outbound-attachments";
import {
	formatRecipients,
	replySubject,
	type CreateDraftBody,
	type OutboundMessageBody,
	type ForwardBody,
	type ReplyBody,
} from "./outbound-payload";
import { resolveReplyRecipients } from "./resolve-reply-recipients";
import { persistMessage, rollbackNewThread } from "./persist-message";
import { sendEmail } from "./send-email";
import { completeDraftSend, draftSendPromoteFromDrafts } from "./complete-draft-send";
import { replaceStoredMessageContent } from "./update-stored-message";

export type OutboundContext = {
	db: Database;
	bucket: R2Bucket;
	email: SendEmail;
};

type ThreadingContext = {
	threadId: string;
	inReplyTo: string | null;
	references: string[] | null;
	isReply: boolean;
};

async function resolveThreadingForCompose(
	db: Database,
	body: CreateDraftBody,
): Promise<{
	threading: ThreadingContext;
	parent: typeof messages.$inferSelect | null;
}> {
	const parent = body.inReplyToMessageId
		? await findMessageById(db, body.inReplyToMessageId)
		: null;

	if (body.inReplyToMessageId && !parent) {
		throw new Error("Parent message not found");
	}

	const threadId =
		body.threadId ?? parent?.threadId ?? crypto.randomUUID();
	const isReply = Boolean(body.threadId || body.inReplyToMessageId || parent);

	if (body.threadId) {
		const thread = await findThreadById(db, body.threadId);
		if (!thread) {
			throw new Error("Thread not found");
		}
	}

	const replyHeaders = parent
		? buildReplyThreading({
				messageId: parent.messageId,
				references: parent.references,
			})
		: null;

	return {
		parent,
		threading: {
			threadId,
			inReplyTo: replyHeaders?.inReplyTo ?? null,
			references: replyHeaders?.references ?? null,
			isReply,
		},
	};
}

function resolveReplyPayload(
	replyBody: ReplyBody,
	parent: typeof messages.$inferSelect,
	recipients: Pick<OutboundMessageBody, "to" | "cc" | "bcc">,
): OutboundMessageBody {
	return {
		to: recipients.to,
		cc: recipients.cc ?? replyBody.cc,
		bcc: recipients.bcc ?? replyBody.bcc,
		subject: replyBody.subject ?? replySubject(parent.subject),
		text: replyBody.text,
		html: replyBody.html,
		attachments: replyBody.attachments,
	};
}

async function sendAndPersistNewMessage(
	ctx: OutboundContext,
	mailboxId: string,
	payload: OutboundMessageBody,
	threading: ThreadingContext,
	threadFolder: ThreadFolder,
): Promise<typeof messages.$inferSelect> {
	const mailbox = await loadMailboxForSend(ctx.db, mailboxId);
	if (!mailbox) {
		throw new Error("Mailbox not found or cannot send");
	}

	await assertCanSendFrom(ctx.db, mailbox.id);

	const recipients = formatRecipients(payload);
	const id = crypto.randomUUID();
	const now = new Date();
	const preview = buildPreview(payload.text ?? null);
	const attachmentInputs = outboundAttachmentsToStoredInputs(payload.attachments);

	const threadTouch: ThreadTouchData = {
		subject: payload.subject,
		preview,
		lastMessageAt: now,
		actualMailboxId: mailbox.id,
		folder: threadFolder,
		markUnread: false,
	};

	const { isNew: isNewThread } = await prepareThreadForMessage(
		ctx.db,
		threading.threadId,
		threadTouch,
	);

	const sendPayload = buildEmailSendPayload({
		from: mailbox.address,
		payload,
		inReplyTo: threading.inReplyTo,
		references: threading.references,
		attachmentInputs,
	});

	let rfcMessageId: string;

	try {
		const result = await sendEmail(ctx.email, sendPayload);
		rfcMessageId = canonicalizeSentMessageId(result.messageId);
	} catch (error) {
		await rollbackNewThread(ctx.db, threading.threadId, isNewThread);
		throw error;
	}

	try {
		const persistResult = await persistMessage({
			db: ctx.db,
			bucket: ctx.bucket,
			id,
			threadId: threading.threadId,
			row: {
				threadId: threading.threadId,
				messageId: rfcMessageId,
				direction: "outbound",
				sendStatus: "sent",
				inReplyTo: threading.inReplyTo,
				references: threading.references,
				from: mailbox.address,
				to: recipients.to,
				envelopeTo: recipients.envelopeTo,
				actualMailboxId: mailbox.id,
				matchedMailboxId: mailbox.id,
				matchedVia: "outbound",
				cc: recipients.cc,
				bcc: recipients.bcc,
				subject: payload.subject,
				textBody: payload.text ?? null,
				preview,
				hasHtml: Boolean(payload.html),
				hasAttachments: attachmentInputs.length > 0,
				sentAt: now,
				receivedAt: now,
				sendErrorCode: null,
				sendErrorMessage: null,
			},
			mimeContent: buildOutboundMimeContent({
				from: mailbox.address,
				payload,
				rfcMessageId,
				inReplyTo: threading.inReplyTo,
				references: threading.references,
			}),
			attachmentInputs,
			threadTouch,
			isNewThread,
		});

		if (persistResult.status === "duplicate") {
			await rollbackNewThread(ctx.db, threading.threadId, isNewThread);

			const existing = await findMessageRowByRfcMessageId(
				ctx.db,
				rfcMessageId,
			);
			if (!existing) {
				throw new Error("Message-ID conflict while storing outbound message");
			}

			await linkMessageMailboxes(ctx.db, existing.id, [mailbox.id]);

			const stored = await findMessageById(ctx.db, existing.id);
			if (!stored) {
				throw new Error("Stored message not found");
			}

			await finalizeThreadOnOutboundSend(
				ctx.db,
				stored.threadId,
				{
					subject: payload.subject,
					preview,
					lastMessageAt: now,
					actualMailboxId: mailbox.id,
					folder: "sent",
					markUnread: false,
				},
				stored,
			);

			return stored;
		}

		const stored = await findMessageById(ctx.db, persistResult.id);
		if (!stored) {
			throw new Error("Stored message not found");
		}

		return stored;
	} catch (error) {
		await rollbackNewThread(ctx.db, threading.threadId, isNewThread);
		throw error;
	}
}

async function persistDraftMessage(
	ctx: OutboundContext,
	mailboxId: string,
	payload: OutboundMessageBody,
	threading: ThreadingContext,
): Promise<typeof messages.$inferSelect> {
	const mailbox = await loadMailboxForSend(ctx.db, mailboxId);
	if (!mailbox) {
		throw new Error("Mailbox not found or cannot send");
	}

	await assertCanSendFrom(ctx.db, mailbox.id);

	const recipients = formatRecipients(payload);
	const rfcMessageId = generateMessageId(mailbox.domain);
	const id = crypto.randomUUID();
	const now = new Date();
	const preview = buildPreview(payload.text ?? null);
	const attachmentInputs = outboundAttachmentsToStoredInputs(payload.attachments);

	const existingMailboxView = threading.isReply
		? await findThreadMailbox(ctx.db, threading.threadId, mailboxId)
		: null;

	const threadTouch: ThreadTouchData = {
		subject: payload.subject,
		preview,
		lastMessageAt: now,
		actualMailboxId: mailbox.id,
		folder: threading.isReply
			? (existingMailboxView?.folder ?? "inbox")
			: "drafts",
		markUnread: false,
	};

	const { isNew: isNewThread } = await prepareThreadForMessage(
		ctx.db,
		threading.threadId,
		threadTouch,
	);

	try {
		const persistResult = await persistMessage({
			db: ctx.db,
			bucket: ctx.bucket,
			id,
			threadId: threading.threadId,
			row: {
				threadId: threading.threadId,
				messageId: rfcMessageId,
				direction: "outbound",
				sendStatus: "draft",
				inReplyTo: threading.inReplyTo,
				references: threading.references,
				from: mailbox.address,
				to: recipients.to,
				envelopeTo: recipients.envelopeTo,
				actualMailboxId: mailbox.id,
				matchedMailboxId: mailbox.id,
				matchedVia: "outbound",
				cc: recipients.cc,
				bcc: recipients.bcc,
				subject: payload.subject,
				textBody: payload.text ?? null,
				preview,
				hasHtml: Boolean(payload.html),
				hasAttachments: attachmentInputs.length > 0,
				sentAt: null,
				receivedAt: now,
				sendErrorCode: null,
				sendErrorMessage: null,
			},
			mimeContent: buildOutboundMimeContent({
				from: mailbox.address,
				payload,
				rfcMessageId,
				inReplyTo: threading.inReplyTo,
				references: threading.references,
			}),
			attachmentInputs,
			threadTouch,
			isNewThread,
		});

		if (persistResult.status === "duplicate") {
			await rollbackNewThread(ctx.db, threading.threadId, isNewThread);
			throw new Error("Message-ID conflict while storing draft");
		}

		const stored = await findMessageById(ctx.db, persistResult.id);
		if (!stored) {
			throw new Error("Stored draft not found");
		}

		return stored;
	} catch (error) {
		await rollbackNewThread(ctx.db, threading.threadId, isNewThread);
		throw error;
	}
}

export async function createDraft(
	ctx: OutboundContext,
	body: CreateDraftBody,
) {
	const { parent, threading } = await resolveThreadingForCompose(ctx.db, body);
	const payload: OutboundMessageBody = {
		to: body.to,
		cc: body.cc,
		bcc: body.bcc,
		subject:
			body.subject ||
			(parent ? replySubject(parent.subject) : ""),
		text: body.text,
		html: body.html,
		attachments: body.attachments,
	};

	return persistDraftMessage(ctx, body.mailboxId, payload, threading);
}

export async function getDraft(
	ctx: OutboundContext,
	messageId: string,
) {
	const draft = await findDraftById(ctx.db, messageId);
	if (!draft) {
		throw new Error("Draft not found");
	}

	return draft;
}

export async function updateDraft(
	ctx: OutboundContext,
	messageId: string,
	body: OutboundMessageBody,
) {
	const draft = await findDraftById(ctx.db, messageId);
	if (!draft) {
		throw new Error("Draft not found");
	}

	const mailboxId = draft.actualMailboxId;
	const mailbox = await loadMailboxForSend(ctx.db, mailboxId);
	if (!mailbox) {
		throw new Error("Mailbox not found or cannot send");
	}

	await assertCanSendFrom(ctx.db, mailbox.id);

	const recipients = formatRecipients(body);
	const preview = buildPreview(body.text ?? null);
	const attachmentInputs =
		body.attachments !== undefined
			? outboundAttachmentsToStoredInputs(body.attachments)
			: await loadStoredAttachmentInputs(ctx.db, ctx.bucket, messageId);
	const now = new Date();

	await replaceStoredMessageContent(
		ctx.db,
		ctx.bucket,
		messageId,
		buildOutboundMimeContent({
			from: mailbox.address,
			payload: body,
			rfcMessageId: draft.messageId,
			inReplyTo: draft.inReplyTo,
			references: draft.references,
		}),
		attachmentInputs,
		{
			to: recipients.to,
			cc: recipients.cc,
			bcc: recipients.bcc,
			envelopeTo: recipients.envelopeTo,
			subject: body.subject,
			textBody: body.text ?? null,
			preview,
			hasHtml: Boolean(body.html),
			receivedAt: now,
		},
	);

	await ctx.db
		.update(threads)
		.set({
			subject: body.subject,
			updatedAt: now,
		})
		.where(eq(threads.id, draft.threadId));

	await refreshThreadMailboxStats(ctx.db, draft.threadId, mailboxId);

	const updated = await findMessageById(ctx.db, messageId);
	if (!updated) {
		throw new Error("Updated draft not found");
	}

	return updated;
}

export async function deleteDraft(
	ctx: OutboundContext,
	messageId: string,
): Promise<void> {
	const draft = await findDraftById(ctx.db, messageId);
	if (!draft) {
		throw new Error("Draft not found");
	}

	const storedAttachments = await ctx.db
		.select({ storageKey: attachments.storageKey })
		.from(attachments)
		.where(eq(attachments.messageId, messageId));

	await deleteR2Objects(ctx.bucket, [
		draft.rawEmlKey,
		...storedAttachments.map((attachment) => attachment.storageKey),
	]);

	const threadId = draft.threadId;
	await ctx.db.delete(messages).where(eq(messages.id, messageId));
	await refreshThreadAfterDraftDelete(ctx.db, threadId);
}

export async function sendDraftMessage(
	ctx: OutboundContext,
	messageId: string,
) {
	const [draft] = await ctx.db
		.select()
		.from(messages)
		.where(
			and(
				eq(messages.id, messageId),
				eq(messages.direction, "outbound"),
				eq(messages.sendStatus, "draft"),
			),
		)
		.limit(1);

	if (!draft) {
		throw new Error("Draft not found");
	}

	const mailbox = await loadMailboxForSend(ctx.db, draft.actualMailboxId);
	if (!mailbox) {
		throw new Error("Mailbox not found or cannot send");
	}

	await assertCanSendFrom(ctx.db, mailbox.id);

	const payload = await loadDraftOutboundPayload(ctx.bucket, draft);
	const attachmentInputs = await loadStoredAttachmentInputs(
		ctx.db,
		ctx.bucket,
		messageId,
	);
	const now = new Date();
	const sendPayload = buildEmailSendPayload({
		from: mailbox.address,
		payload,
		inReplyTo: draft.inReplyTo,
		references: draft.references,
		attachmentInputs,
	});

	const result = await sendEmail(ctx.email, sendPayload);
	const rfcMessageId = canonicalizeSentMessageId(result.messageId);

	const sent = await completeDraftSend({
		db: ctx.db,
		bucket: ctx.bucket,
		draft,
		rfcMessageId,
		mimeContent: buildOutboundMimeContent({
			from: mailbox.address,
			payload,
			rfcMessageId,
			inReplyTo: draft.inReplyTo,
			references: draft.references,
		}),
		attachmentInputs,
		sentAt: now,
	});

	await finalizeThreadOnOutboundSend(
		ctx.db,
		sent.threadId,
		{
			subject: draft.subject,
			preview: draft.preview,
			lastMessageAt: now,
			actualMailboxId: mailbox.id,
			folder: sent.id !== draft.id ? "sent" : undefined,
			promoteFromDrafts: draftSendPromoteFromDrafts(draft, sent),
			markUnread: false,
		},
		sent,
	);

	return sent;
}

export async function directSend(
	ctx: OutboundContext,
	mailboxId: string,
	body: OutboundMessageBody,
) {
	return sendAndPersistNewMessage(
		ctx,
		mailboxId,
		body,
		{
			threadId: crypto.randomUUID(),
			inReplyTo: null,
			references: null,
			isReply: false,
		},
		"sent",
	);
}

export async function replyToMessage(
	ctx: OutboundContext,
	messageId: string,
	body: ReplyBody,
) {
	const parent = await findMessageById(ctx.db, messageId);
	if (!parent) {
		throw new Error("Message not found");
	}

	const mailbox = await loadMailboxForSend(ctx.db, body.mailboxId);
	if (!mailbox) {
		throw new Error("Mailbox not found or cannot send");
	}

	const [threadLink] = await ctx.db
		.select({ threadId: threadMailboxes.threadId })
		.from(threadMailboxes)
		.where(
			and(
				eq(threadMailboxes.threadId, parent.threadId),
				eq(threadMailboxes.mailboxId, body.mailboxId),
			),
		)
		.limit(1);

	if (!threadLink) {
		throw new Error("Thread not found");
	}

	const replyHeaders = buildReplyThreading({
		messageId: parent.messageId,
		references: parent.references,
	});

	const resolvedRecipients = await resolveReplyRecipients(
		ctx.bucket,
		parent,
		mailbox.address,
		body.replyAll === true,
		{
			to: body.to,
			cc: body.cc,
			bcc: body.bcc,
		},
	);

	const mailboxView = await findThreadMailbox(ctx.db, parent.threadId, body.mailboxId);
	const payload = resolveReplyPayload(body, parent, resolvedRecipients);

	return sendAndPersistNewMessage(
		ctx,
		body.mailboxId,
		payload,
		{
			threadId: parent.threadId,
			inReplyTo: replyHeaders.inReplyTo,
			references: replyHeaders.references,
			isReply: true,
		},
		mailboxView?.folder === "drafts" ? "sent" : (mailboxView?.folder ?? "inbox"),
	);
}

async function loadParentContentForForward(
	ctx: OutboundContext,
	parent: typeof messages.$inferSelect,
): Promise<{ text: string | null; html: string | null }> {
	const object = await ctx.bucket.get(parent.rawEmlKey);
	if (!object) {
		return {
			text: parent.textBody,
			html: null,
		};
	}

	const parsed = await PostalMime.parse(await object.arrayBuffer());
	return {
		text: parsed.text ?? parent.textBody,
		html: parsed.html ?? null,
	};
}

function mergeForwardAttachments(
	userAttachments: OutboundAttachmentInput[] | undefined,
	parentAttachments: OutboundAttachmentInput[],
): OutboundAttachmentInput[] | undefined {
	const merged = [...(userAttachments ?? []), ...parentAttachments];
	return merged.length > 0 ? merged : undefined;
}

export async function forwardMessage(
	ctx: OutboundContext,
	messageId: string,
	body: ForwardBody,
) {
	await assertMessageVisibleInMailbox(ctx.db, messageId, body.mailboxId);

	const parent = await findMessageById(ctx.db, messageId);
	if (!parent) {
		throw new Error("Message not found");
	}

	const mailbox = await loadMailboxForSend(ctx.db, body.mailboxId);
	if (!mailbox) {
		throw new Error("Mailbox not found or cannot send");
	}

	const parentContent = await loadParentContentForForward(ctx, parent);
	const quotedText = buildForwardQuotedText({
		from: parent.from,
		subject: parent.subject,
		text: parentContent.text,
		sentAt: parent.sentAt,
		receivedAt: parent.receivedAt,
	});
	const quotedHtml = buildForwardQuotedHtml({
		from: parent.from,
		subject: parent.subject,
		html: parentContent.html,
		text: parentContent.text,
		sentAt: parent.sentAt,
		receivedAt: parent.receivedAt,
	});

	const text = body.includeQuotedBody
		? buildForwardBodyText(body.text, quotedText)
		: body.text;
	const html = body.includeQuotedBody
		? buildForwardBodyHtml(body.html, quotedHtml)
		: body.html;

	const parentAttachments = body.includeAttachments
		? storedInputsToOutboundAttachments(
				await loadStoredAttachmentInputs(ctx.db, ctx.bucket, messageId),
			)
		: [];

	const payload: OutboundMessageBody = {
		to: body.to,
		cc: body.cc,
		bcc: body.bcc,
		subject: body.subject ?? forwardSubject(parent.subject),
		text,
		html,
		attachments: mergeForwardAttachments(body.attachments, parentAttachments),
	};

	if (!payload.text && !payload.html) {
		throw new Error("At least one of 'text' or 'html' is required");
	}

	return sendAndPersistNewMessage(
		ctx,
		body.mailboxId,
		payload,
		{
			threadId: crypto.randomUUID(),
			inReplyTo: null,
			references: null,
			isReply: false,
		},
		"sent",
	);
}
