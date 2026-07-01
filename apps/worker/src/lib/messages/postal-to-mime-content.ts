import type { Email } from "postal-mime";

import { formatAddress, formatAddressList } from "../format-address";
import type { MimeHeader, MimeMessageContent } from "./mime-message-content";

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

export function postalEmailToMimeContent(parsed: Email): MimeMessageContent {
	const headers: MimeHeader[] = parsed.headers
		.filter((header) => !MANAGED_HEADER_KEYS.has(header.key))
		.map((header) => ({
			key: header.originalKey,
			value: header.value,
		}));

	return {
		from: formatAddress(parsed.from) ?? "",
		to: formatAddressList(parsed.to) ?? "",
		cc: formatAddressList(parsed.cc),
		bcc: formatAddressList(parsed.bcc),
		subject: parsed.subject ?? null,
		text: parsed.text ?? null,
		html: parsed.html ?? null,
		headers,
	};
}
