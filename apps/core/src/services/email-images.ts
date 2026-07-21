import { and, eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { messageExternalImages } from "../db/schema";
import { assertPrincipalCanReadMessage } from "../lib/email-images/assert-message-readable";
import { ensureCachedImageAvailable } from "../lib/email-images/cache-image";
import type { MailboxReadContext } from "../lib/messages/mailbox-read-context";

export async function serveMessageExternalImage(
	ctx: MailboxReadContext,
	messageId: string,
	imageId: string,
): Promise<Response> {
	await assertPrincipalCanReadMessage(ctx.db, ctx.principal, messageId);

	const [row] = await ctx.db
		.select({
			id: messageExternalImages.id,
			messageId: messageExternalImages.messageId,
			sourceUrl: messageExternalImages.sourceUrl,
			cacheKey: messageExternalImages.cacheKey,
			mimeType: messageExternalImages.mimeType,
			sizeBytes: messageExternalImages.sizeBytes,
			fetched: messageExternalImages.fetched,
		})
		.from(messageExternalImages)
		.where(
			and(
				eq(messageExternalImages.id, imageId),
				eq(messageExternalImages.messageId, messageId),
			),
		)
		.limit(1);

	if (!row) {
		throw new Error("Image not found");
	}

	const cached = await ensureCachedImageAvailable(ctx.bucket, row);
	if (!cached) {
		throw new Error("Image not found");
	}

	const headers = new Headers();
	const mime = cached.mimeType.toLowerCase();
	if (mime.includes("svg")) {
		throw new Error("Image not found");
	}
	headers.set("Content-Type", cached.mimeType);
	headers.set("Cache-Control", "private, max-age=86400");
	headers.set("Content-Disposition", "inline");
	headers.set("X-Content-Type-Options", "nosniff");

	return new Response(cached.body.body, { headers });
}

export async function downloadMessageExternalImage(
	db: Database,
	bucket: R2Bucket,
	principal: MailboxReadContext["principal"],
	messageId: string,
	imageId: string,
): Promise<Response> {
	return serveMessageExternalImage(
		{ db, bucket, principal },
		messageId,
		imageId,
	);
}
