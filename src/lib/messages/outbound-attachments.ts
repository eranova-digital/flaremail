import { decodeBase64 } from "./decode-base64";
import type { OutboundMessageBody } from "./outbound-payload";
import type { StoredAttachmentInput } from "./stored-attachment-input";

export type OutboundAttachmentInput = {
	filename: string;
	mimeType: string;
	content: string;
	disposition?: "attachment" | "inline";
	contentId?: string;
};

export function outboundAttachmentsToStoredInputs(
	attachmentInputs: OutboundAttachmentInput[] | undefined,
): StoredAttachmentInput[] {
	if (!attachmentInputs?.length) {
		return [];
	}

	return attachmentInputs.map((attachment) => ({
		filename: attachment.filename,
		mimeType: attachment.mimeType,
		content: decodeBase64(attachment.content),
		disposition: attachment.disposition ?? "attachment",
		contentId: attachment.contentId ?? null,
	}));
}

export async function loadDraftOutboundPayload(
	bucket: R2Bucket,
	draft: {
		id: string;
		to: string;
		cc: string | null;
		bcc: string | null;
		subject: string | null;
		textBody: string | null;
		hasHtml: boolean;
		rawEmlKey: string;
	},
): Promise<OutboundMessageBody> {
	let html: string | undefined;
	let text = draft.textBody ?? undefined;

	if (draft.hasHtml) {
		const raw = await bucket.get(draft.rawEmlKey);
		if (raw) {
			const PostalMime = (await import("postal-mime")).default;
			const parsed = await PostalMime.parse(await raw.arrayBuffer());
			html = parsed.html ?? undefined;
			text = text ?? parsed.text ?? undefined;
		}
	}

	return {
		to: draft.to.split(",").map((address) => address.trim()),
		cc: draft.cc?.split(",").map((address) => address.trim()),
		bcc: draft.bcc?.split(",").map((address) => address.trim()),
		subject: draft.subject ?? "",
		text,
		html,
	};
}
