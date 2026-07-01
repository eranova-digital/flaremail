import { createMimeMessage } from "mimetext";

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

	if (content.to) {
		mime.setRecipient(content.to);
	}

	if (content.cc) {
		mime.setCc(content.cc);
	}

	if (content.bcc) {
		mime.setBcc(content.bcc);
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
