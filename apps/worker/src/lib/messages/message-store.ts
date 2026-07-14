import { eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import {
	attachments,
	messageExternalImages,
	messages,
	type NewMessage,
	type NewMessageExternalImage,
} from "../../db/schema";
import { buildStrippedEml } from "../build-stripped-eml";
import { deleteR2Objects } from "../r2-cleanup";
import { storeAttachments } from "../store-attachments";
import { storeRawEml } from "../store-raw-eml";
import {
	deleteThreadIfEmpty,
	linkMessageMailboxes,
	onMessagePersisted,
	resolveMessageMailboxIds,
	type ThreadTouchData,
} from "../thread-mailbox";
import type { MimeMessageContent } from "./mime-message-content";
import type { StoredAttachmentInput } from "./stored-attachment-input";

export type PersistMessageInput = {
	db: Database;
	bucket: R2Bucket;
	id: string;
	threadId: string;
	row: Omit<NewMessage, "id" | "rawEmlKey">;
	mimeContent: MimeMessageContent;
	attachmentInputs: StoredAttachmentInput[];
	externalImageInputs?: NewMessageExternalImage[];
	threadTouch: ThreadTouchData;
	isNewThread: boolean;
};

export type PersistMessageResult =
	| { status: "inserted"; id: string }
	| { status: "duplicate" };

async function persistMessageRow(
	input: PersistMessageInput,
): Promise<PersistMessageResult> {
	const uploadedKeys: string[] = [];

	try {
		const storedAttachments = await storeAttachments(
			input.bucket,
			input.id,
			input.attachmentInputs,
		);
		uploadedKeys.push(
			...storedAttachments.map((attachment) => attachment.storageKey),
		);

		const strippedEml = buildStrippedEml(
			input.mimeContent,
			storedAttachments.map((attachment) => attachment.storageKey),
		);
		const rawEmlKey = await storeRawEml(input.bucket, input.id, strippedEml);
		uploadedKeys.push(rawEmlKey);

		const [inserted] = await input.db
			.insert(messages)
			.values({
				...input.row,
				id: input.id,
				rawEmlKey,
			})
			.onConflictDoNothing({ target: messages.messageId })
			.returning({ id: messages.id });

		if (!inserted) {
			return { status: "duplicate" };
		}

		try {
			if (storedAttachments.length > 0) {
				await input.db.insert(attachments).values(storedAttachments);
			}

			if (input.externalImageInputs && input.externalImageInputs.length > 0) {
				await input.db
					.insert(messageExternalImages)
					.values(input.externalImageInputs);
			}

			const mailboxIds = await resolveMessageMailboxIds(input.db, input.row);
			await linkMessageMailboxes(input.db, inserted.id, mailboxIds);
			await onMessagePersisted(input.db, {
				threadId: input.threadId,
				messageId: inserted.id,
				touch: input.threadTouch,
			});
		} catch (error) {
			await input.db.delete(messages).where(eq(messages.id, inserted.id));
			throw error;
		}

		uploadedKeys.length = 0;
		return { status: "inserted", id: inserted.id };
	} finally {
		if (uploadedKeys.length > 0) {
			await deleteR2Objects(input.bucket, uploadedKeys);
		}
	}
}

export async function rollbackNewThread(
	db: Database,
	threadId: string,
	isNewThread: boolean,
): Promise<void> {
	if (isNewThread) {
		await deleteThreadIfEmpty(db, threadId);
	}
}

/**
 * Insert a message with R2 + visibility + thread sync. On duplicate Message-ID
 * or failure, rolls back a newly created thread when applicable, then delegates
 * duplicate resolution to the caller.
 */
export async function storeMessage(
	input: PersistMessageInput,
	resolveDuplicate: () => Promise<string>,
): Promise<string> {
	try {
		const result = await persistMessageRow(input);

		if (result.status === "duplicate") {
			await rollbackNewThread(input.db, input.threadId, input.isNewThread);
			return resolveDuplicate();
		}

		return result.id;
	} catch (error) {
		await rollbackNewThread(input.db, input.threadId, input.isNewThread);
		throw error;
	}
}

/** @deprecated Use storeMessage */
export async function persistMessage(
	input: PersistMessageInput,
): Promise<PersistMessageResult> {
	return persistMessageRow(input);
}
