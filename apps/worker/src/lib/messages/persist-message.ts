import { eq } from "drizzle-orm";

import { attachments, messages, type NewMessage } from "../../db/schema";
import type { Database } from "../../db/client";
import { buildStrippedEml } from "../build-stripped-eml";
import {
	linkMessageMailboxes,
	resolveMessageMailboxIds,
} from "../message-mailboxes";
import { onMessagePersisted } from "../thread-mailbox-sync";
import { deleteR2Objects } from "../r2-cleanup";
import { storeAttachments } from "../store-attachments";
import { storeRawEml } from "../store-raw-eml";
import {
	deleteThreadIfEmpty,
	type ThreadTouchData,
} from "../touch-thread";
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
	threadTouch: ThreadTouchData;
	isNewThread: boolean;
};

export type PersistMessageResult =
	| { status: "inserted"; id: string }
	| { status: "duplicate" };

export async function persistMessage(
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

			const mailboxIds = await resolveMessageMailboxIds(input.db, input.row);
			await linkMessageMailboxes(input.db, inserted.id, mailboxIds);
			await onMessagePersisted(
				input.db,
				input.threadId,
				inserted.id,
				input.threadTouch,
			);
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
