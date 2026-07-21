import type { Database } from "../../db/client";
import { messages } from "../../db/schema";
import { buildReplyThreading } from "./build-reply-threading";
import { findMessageById, findThreadById } from "./message-queries";
import {
	replySubject,
	type CreateDraftBody,
	type OutboundMessageBody,
	type ReplyBody,
} from "./outbound-payload";

export type ThreadingContext = {
	threadId: string;
	inReplyTo: string | null;
	references: string[] | null;
	isReply: boolean;
};

export async function resolveThreadingForCompose(
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

export function resolveReplyPayload(
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
