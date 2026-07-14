import type { Email } from "postal-mime";

import type { Database } from "../../db/client";
import { findMessageRowByRfcMessageId } from "../find-message";
import { formatAddress, formatAddressList } from "../format-address";
import type { StoreMailboxResolution } from "../resolve-mailbox";
import { resolveThreadId } from "../resolve-thread-id";
import { postalAttachmentToStoredInput } from "../store-attachments";
import { extractThreadingHeaders } from "../threading-headers";
import {
	prepareThreadForMessage,
	type ThreadTouchData,
} from "../thread-mailbox";
import { buildPreview, parseSentAt } from "./message-utils";
import { storeMessage } from "./message-store";
import { postalEmailToMimeContent } from "./postal-to-mime-content";
import type { StoredAttachmentInput } from "./stored-attachment-input";
import { processInboundHtmlImages } from "../email-images/process-inbound-html";

export async function storeInboundEmail(
	db: Database,
	bucket: R2Bucket,
	message: ForwardableEmailMessage,
	parsed: Email,
	mailbox: StoreMailboxResolution,
): Promise<string> {
	const threading = extractThreadingHeaders(message.headers, parsed);

	if (!threading.messageId) {
		throw new Error("Message-ID header is required");
	}

	const existing = await findMessageRowByRfcMessageId(db, threading.messageId);
	if (existing) {
		return existing.id;
	}

	const id = crypto.randomUUID();
	const threadId = await resolveThreadId(db, threading);
	const receivedAt = new Date();
	const subject = parsed.subject ?? message.headers.get("subject");
	const textBody = parsed.text ?? null;
	const preview = buildPreview(textBody);
	const threadTouch: ThreadTouchData = {
		subject,
		preview,
		lastMessageAt: receivedAt,
		actualMailboxId: mailbox.actualMailboxId,
		matchedMailboxId: mailbox.matchedMailboxId,
		folder: "inbox",
		markUnread: true,
	};

	const { isNew: isNewThread } = await prepareThreadForMessage(
		db,
		threadId,
		threadTouch,
	);

	const attachmentInputs = parsed.attachments
		.map((part, index) => postalAttachmentToStoredInput(part, index))
		.filter((part): part is StoredAttachmentInput => part !== null);

	const mimeContent = postalEmailToMimeContent(parsed);
	let externalImageInputs: Awaited<
		ReturnType<typeof processInboundHtmlImages>
	>["externalImages"] = [];

	if (mimeContent.html) {
		const processed = await processInboundHtmlImages(
			mimeContent.html,
			id,
			bucket,
		);
		mimeContent.html = processed.html;
		externalImageInputs = processed.externalImages;
	}

	return storeMessage(
		{
			db,
			bucket,
			id,
			threadId,
			row: {
				threadId,
				messageId: threading.messageId,
				direction: "inbound",
				sendStatus: null,
				inReplyTo: threading.inReplyTo,
				references: threading.references,
				from: formatAddress(parsed.from) ?? message.from,
				to: formatAddressList(parsed.to) ?? message.to,
				envelopeTo: mailbox.envelopeTo,
				actualMailboxId: mailbox.actualMailboxId,
				matchedMailboxId: mailbox.matchedMailboxId,
				matchedVia: mailbox.matchedVia,
				cc: formatAddressList(parsed.cc),
				bcc: formatAddressList(parsed.bcc),
				subject,
				textBody,
				preview,
				hasHtml: Boolean(mimeContent.html),
				hasAttachments: attachmentInputs.length > 0,
				sentAt: parseSentAt(message.headers.get("date"), parsed.date),
				receivedAt,
				sendErrorCode: null,
				sendErrorMessage: null,
			},
			mimeContent,
			attachmentInputs,
			externalImageInputs,
			threadTouch,
			isNewThread,
		},
		async () => {
			const duplicate = await findMessageRowByRfcMessageId(
				db,
				threading.messageId!,
			);
			if (!duplicate) {
				throw new Error(
					`Message-ID conflict without existing row: ${threading.messageId}`,
				);
			}
			return duplicate.id;
		},
	);
}
