import { assertCanSendFrom } from "../authorize-mailbox";
import { findMessageRowByRfcMessageId } from "../find-message";
import {
	findThreadMailbox,
	linkMessageMailboxes,
} from "../message-mailboxes";
import { loadMailboxForSend } from "../mailbox-queries";
import { finalizeThreadOnOutboundSend } from "../touch-thread-outbound";
import {
	prepareThreadForMessage,
	type ThreadFolder,
	type ThreadTouchData,
} from "../touch-thread";
import {
	buildEmailSendPayload,
	buildOutboundMimeContent,
} from "./build-outbound-mime";
import { generateMessageId, canonicalizeSentMessageId } from "./message-id";
import { findMessageById } from "./message-queries";
import { buildPreview } from "./message-utils";
import type { OutboundContext } from "./outbound-context";
import { outboundAttachmentsToStoredInputs } from "./outbound-attachments";
import { formatRecipients, type OutboundMessageBody } from "./outbound-payload";
import type { ThreadingContext } from "./outbound-threading";
import { persistMessage, rollbackNewThread } from "./persist-message";
import { sendEmail } from "./send-email";

export async function sendAndPersistNewMessage(
	ctx: OutboundContext,
	mailboxId: string,
	payload: OutboundMessageBody,
	threading: ThreadingContext,
	threadFolder: ThreadFolder,
): Promise<typeof import("../../db/schema").messages.$inferSelect> {
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

			const existing = await findMessageRowByRfcMessageId(ctx.db, rfcMessageId);
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

export async function persistDraftMessage(
	ctx: OutboundContext,
	mailboxId: string,
	payload: OutboundMessageBody,
	threading: ThreadingContext,
): Promise<typeof import("../../db/schema").messages.$inferSelect> {
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
