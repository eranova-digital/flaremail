import { createMimeMessage } from "mimetext";

import { splitAddressList } from "./addresses";
import type { MimeMessageContent } from "./messages/mime-message-content";

const MANAGED_HEADER_KEYS = new Set([
	"content-type",
	"content-transfer-encoding",
	"content-disposition",
	"content-id",
	"from",
	"to",
	"cc",
	"bcc",
	"reply-to",
	"sender",
	"subject",
]);

export function buildStrippedEml(
	content: MimeMessageContent,
	externalAttachmentKeys: string[],
): Uint8Array {
	const mime = createMimeMessage();

	for (const header of content.headers ?? []) {
		if (MANAGED_HEADER_KEYS.has(header.key.toLowerCase())) {
			continue;
		}

		mime.setHeader(header.key, header.value);
	}

	if (content.from) {
		mime.setSender(content.from);
	}

	const toAddresses = content.to ? splitAddressList(content.to) : [];
	if (toAddresses.length) {
		mime.setRecipient(toAddresses);
	}

	const ccAddresses = content.cc ? splitAddressList(content.cc) : [];
	if (ccAddresses.length) {
		mime.setCc(ccAddresses);
	}

	const bccAddresses = content.bcc ? splitAddressList(content.bcc) : [];
	if (bccAddresses.length) {
		mime.setBcc(bccAddresses);
	}

	if (content.subject) {
		mime.setSubject(content.subject);
	}

	for (const storageKey of externalAttachmentKeys) {
		mime.setHeader("X-Attachment-External", storageKey);
	}

	if (content.text) {
		mime.addMessage({
			contentType: "text/plain",
			charset: "utf-8",
			data: content.text,
		});
	}

	if (content.html) {
		mime.addMessage({
			contentType: "text/html",
			charset: "utf-8",
			data: content.html,
		});
	}

	if (!content.text && !content.html) {
		mime.addMessage({
			contentType: "text/plain",
			charset: "utf-8",
			data: "",
		});
	}

	return new TextEncoder().encode(mime.asRaw());
}
