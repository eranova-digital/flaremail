import type { Database } from "../../db/client";
import type { messages } from "../../db/schema";
import { findMessageRowByRfcMessageId } from "../find-message";
import { isUniqueViolation } from "../db/postgres-error";
import { linkMessageMailboxes } from "../message-mailboxes";
import { findMessageById } from "./message-queries";
import { purgeDraftMessage } from "./purge-draft-message";
import type { MimeMessageContent } from "./mime-message-content";
import type { StoredAttachmentInput } from "./stored-attachment-input";
import { replaceStoredMessageContent } from "./update-stored-message";

type CompleteDraftSendInput = {
	db: Database;
	bucket: R2Bucket;
	draft: typeof messages.$inferSelect;
	rfcMessageId: string;
	mimeContent: MimeMessageContent;
	attachmentInputs: StoredAttachmentInput[];
	sentAt: Date;
};

async function absorbDraftIntoInboundCopy(
	input: CompleteDraftSendInput,
	existingMessageId: string,
): Promise<typeof messages.$inferSelect> {
	const existing = await findMessageById(input.db, existingMessageId);
	if (!existing) {
		throw new Error("Existing sent message not found");
	}

	await purgeDraftMessage(input.db, input.bucket, input.draft);
	await linkMessageMailboxes(input.db, existing.id, [
		input.draft.actualMailboxId,
	]);

	const stored = await findMessageById(input.db, existing.id);
	if (!stored) {
		throw new Error("Stored sent message not found");
	}

	return stored;
}

export async function completeDraftSend(
	input: CompleteDraftSendInput,
): Promise<typeof messages.$inferSelect> {
	const existingByRfc = await findMessageRowByRfcMessageId(
		input.db,
		input.rfcMessageId,
	);

	if (existingByRfc && existingByRfc.id !== input.draft.id) {
		return absorbDraftIntoInboundCopy(input, existingByRfc.id);
	}

	try {
		await replaceStoredMessageContent(
			input.db,
			input.bucket,
			input.draft.id,
			input.mimeContent,
			input.attachmentInputs,
			{
				messageId: input.rfcMessageId,
				sendStatus: "sent",
				sentAt: input.sentAt,
				receivedAt: input.sentAt,
				sendErrorCode: null,
				sendErrorMessage: null,
			},
		);
	} catch (error) {
		if (!isUniqueViolation(error)) {
			throw error;
		}

		const existing = await findMessageRowByRfcMessageId(
			input.db,
			input.rfcMessageId,
		);
		if (!existing || existing.id === input.draft.id) {
			throw error;
		}

		return absorbDraftIntoInboundCopy(input, existing.id);
	}

	const sent = await findMessageById(input.db, input.draft.id);
	if (!sent) {
		throw new Error("Sent message not found");
	}

	return sent;
}

export function draftSendPromoteFromDrafts(
	draft: typeof messages.$inferSelect,
	sent: typeof messages.$inferSelect,
): boolean {
	return sent.id === draft.id && sent.threadId === draft.threadId;
}
