import { eq } from "drizzle-orm";

import { attachments, messages, threads } from "../../db/schema";
import { assertCanSendFrom } from "../authorize-mailbox";
import { refreshThreadMailboxStats } from "../message-mailboxes";
import { loadMailboxForSend } from "../mailbox-queries";
import { deleteR2Objects } from "../r2-cleanup";
import { refreshThreadAfterDraftDelete } from "../touch-thread-outbound";
import { buildOutboundMimeContent } from "./build-outbound-mime";
import { findDraftById, findMessageById } from "./message-queries";
import { buildPreview } from "./message-utils";
import type { OutboundContext } from "./outbound-context";
import {
	loadStoredAttachmentInputs,
	outboundAttachmentsToStoredInputs,
} from "./outbound-attachments";
import {
	formatRecipients,
	replySubject,
	type CreateDraftBody,
	type OutboundMessageBody,
} from "./outbound-payload";
import { persistDraftMessage } from "./outbound-persist";
import { resolveThreadingForCompose } from "./outbound-threading";
import { resolveReplyRecipients } from "./resolve-reply-recipients";
import { replaceStoredMessageContent } from "./update-stored-message";

export async function createDraft(
	ctx: OutboundContext,
	body: CreateDraftBody,
) {
	const { parent, threading } = await resolveThreadingForCompose(ctx.db, body);

	let to = body.to;
	let cc = body.cc;
	let bcc = body.bcc;

	if (parent && (!to || to.length === 0)) {
		const mailbox = await loadMailboxForSend(ctx.db, body.mailboxId);
		if (!mailbox) {
			throw new Error("Mailbox not found or cannot send");
		}

		const resolved = await resolveReplyRecipients(
			ctx.bucket,
			parent,
			mailbox.address,
			false,
			{ to, cc, bcc },
		);
		to = resolved.to;
		cc = resolved.cc ?? cc;
		bcc = resolved.bcc ?? bcc;
	}

	const payload: OutboundMessageBody = {
		to: to ?? [],
		cc,
		bcc,
		subject:
			body.subject ||
			(parent ? replySubject(parent.subject) : ""),
		text: body.text,
		html: body.html,
		attachments: body.attachments,
	};

	return persistDraftMessage(ctx, body.mailboxId, payload, threading);
}

export async function getDraft(ctx: OutboundContext, messageId: string) {
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

	const threadId = draft.threadId;
	await ctx.db.delete(attachments).where(eq(attachments.messageId, messageId));
	await ctx.db.delete(messages).where(eq(messages.id, messageId));
	await refreshThreadAfterDraftDelete(ctx.db, threadId);
	await deleteR2Objects(ctx.bucket, [
		draft.rawEmlKey,
		...storedAttachments.map((attachment) => attachment.storageKey),
	]);
}
