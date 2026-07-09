import type {
	CreateDraftRequest,
	OutboundMessageBody,
} from "@/lib/api/generated/types.gen";
import type { ComposeAttachment } from "@/lib/compose-attachments";
import { composeAttachmentsToOutbound } from "@/lib/compose-attachments";
import {
	fieldsToPayload,
	outboundFromFields,
	type ComposeFields,
	type ComposeReplyContext,
} from "@/hooks/compose/types";

export type PersistDraftArgs = {
	mailboxId: string;
	draftId: string | null;
	fields: ComposeFields;
	attachments: ComposeAttachment[];
	attachmentsDirty: boolean;
	reply?: ComposeReplyContext;
	createDraft: (payload: CreateDraftRequest) => Promise<{ id?: string }>;
	updateDraft: (args: {
		id: string;
		body: OutboundMessageBody;
	}) => Promise<unknown>;
	refreshAttachments?: (messageId: string) => Promise<void>;
};

export type PersistDraftResult =
	| { ok: true; draftId: string; attachmentsDirty: false }
	| { ok: false; error: string };

export async function persistDraft(
	args: PersistDraftArgs,
): Promise<PersistDraftResult> {
	const {
		mailboxId,
		draftId,
		fields,
		attachments,
		attachmentsDirty,
		reply,
		createDraft,
		updateDraft,
		refreshAttachments,
	} = args;

	try {
		let outboundAttachments: OutboundMessageBody["attachments"] | undefined;
		let id = draftId;

		if (!id || attachmentsDirty) {
			outboundAttachments = await composeAttachmentsToOutbound(attachments);
		}

		if (!id) {
			const created = await createDraft(
				fieldsToPayload(fields, mailboxId, reply, outboundAttachments),
			);
			id = created.id ?? null;
			if (!id) {
				return { ok: false, error: "Draft was not created" };
			}
			if (outboundAttachments !== undefined && refreshAttachments) {
				await refreshAttachments(id);
			}
		} else {
			await updateDraft({
				id,
				body: outboundFromFields(fields, outboundAttachments),
			});
			if (outboundAttachments !== undefined && refreshAttachments) {
				await refreshAttachments(id);
			}
		}

		return { ok: true, draftId: id, attachmentsDirty: false };
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Failed to save draft",
		};
	}
}
