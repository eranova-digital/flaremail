import { eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import { attachments, messages } from "../../db/schema";
import { deleteR2Objects } from "../r2-cleanup";
import { deleteThreadIfEmpty } from "../touch-thread";

export async function purgeDraftMessage(
	db: Database,
	bucket: R2Bucket,
	draft: typeof messages.$inferSelect,
): Promise<void> {
	const storedAttachments = await db
		.select({ storageKey: attachments.storageKey })
		.from(attachments)
		.where(eq(attachments.messageId, draft.id));

	const threadId = draft.threadId;
	await db.delete(attachments).where(eq(attachments.messageId, draft.id));
	await db.delete(messages).where(eq(messages.id, draft.id));
	await deleteThreadIfEmpty(db, threadId);
	await deleteR2Objects(bucket, [
		draft.rawEmlKey,
		...storedAttachments.map((attachment) => attachment.storageKey),
	]);
}
