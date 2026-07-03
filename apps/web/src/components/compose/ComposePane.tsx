import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	type ComposeForwardContext,
	type ComposeReplyContext,
	useComposeDraft,
} from "@/hooks/use-compose-draft";
import type { SendResult } from "@/lib/thread-messages-cache";
import { ComposeAttachments } from "@/components/compose/ComposeAttachments";
import { ComposeForwardSource } from "@/components/compose/ComposeForwardSource";
import { getErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

type ComposePaneProps = {
	mailboxId: string;
	existingDraftId?: string;
	reply?: ComposeReplyContext;
	forward?: ComposeForwardContext;
	threadId?: string;
	variant?: "page" | "inline";
	onClose: () => void;
	onSent: (result: SendResult) => void;
	onDeleted?: () => void;
	onDraftIdChange?: (draftId: string | null) => void;
};

export function ComposePane({
	mailboxId,
	existingDraftId,
	reply,
	forward,
	threadId,
	variant = "page",
	onClose,
	onSent,
	onDeleted,
	onDraftIdChange,
}: ComposePaneProps) {
	const compose = useComposeDraft(mailboxId, {
		reply,
		forward,
		existingDraftId,
		threadId,
	});
	const isInline = variant === "inline";
	const isResumedDraft = Boolean(existingDraftId);
	const isForward = compose.isForwardMode;
	const showDraftActions = !isForward;

	// Let the surrounding view know which draft this composer owns so it can
	// avoid rendering that draft twice (once here, once as a thread card) while
	// the reply is being written. Reset to null when the composer unmounts.
	useEffect(() => {
		onDraftIdChange?.(compose.draftId);
		return () => onDraftIdChange?.(null);
	}, [compose.draftId, onDraftIdChange]);
	const isReply = Boolean(reply);
	const isReplyAll = Boolean(reply?.replyAll);
	const hasCcBcc = Boolean(
		compose.fields.cc.trim() || compose.fields.bcc.trim(),
	);
	const [showCcBcc, setShowCcBcc] = useState(false);
	const [showSubjectEditor, setShowSubjectEditor] = useState(false);
	const showToField = !isReply;
	const showCcBccFields = !isReply || isReplyAll || showCcBcc || hasCcBcc;
	const canSend =
		Boolean(compose.fields.subject.trim()) &&
		(isReply || Boolean(compose.fields.to.trim()));

	const handleSend = async () => {
		try {
			const result = await compose.send();
			onSent(result);
		} catch {
			// error surfaced via compose.sendError
		}
	};

	const handleSave = async () => {
		try {
			const saved = await compose.save();
			if (saved) {
				onClose();
			}
		} catch {
			// error surfaced via compose.saveError
		}
	};

	const handleCancel = async () => {
		try {
			compose.clearScheduledSave();
			if (compose.draftId) {
				await compose.discardDraft();
			}
			onClose();
		} catch {
			// error surfaced via compose.deleteError
		}
	};

	const handleDelete = async () => {
		if (!compose.draftId) {
			return;
		}

		if (!window.confirm("Delete this draft permanently?")) {
			return;
		}

		try {
			await compose.removeDraft();
			if (onDeleted) {
				onDeleted();
			} else {
				onClose();
			}
		} catch {
			// error surfaced via compose.deleteError
		}
	};

	if (!compose.initialized) {
		return (
			<div
				className={cn(
					"text-muted-foreground flex items-center justify-center gap-2 text-sm",
					isInline ? "py-8" : "h-full",
				)}
			>
				<Loader2 className="size-4 animate-spin" />
				{existingDraftId
					? "Loading draft…"
					: reply
						? "Preparing reply…"
						: forward
							? "Preparing forward…"
							: "Loading…"}
			</div>
		);
	}

	const header = (
		<div
			className={cn(
				"flex items-center justify-between gap-3",
				isInline ? "mb-3" : "border-b px-4 py-3",
			)}
		>
			<h2 className={cn("font-medium", isInline && "text-sm")}>
				{existingDraftId
					? "Edit draft"
					: reply
						? isReplyAll
							? "Reply all"
							: "Reply"
						: forward
							? "Forward"
							: "New message"}
			</h2>
			<div className="flex items-center gap-2">
				{showDraftActions ? (
					isResumedDraft ? (
						<Button
							variant="outline"
							size={isInline ? "sm" : "default"}
							className="text-destructive hover:text-destructive"
							onClick={() => void handleDelete()}
							disabled={compose.isDeleting || compose.isSending || compose.isSaving}
						>
							{compose.isDeleting ? (
								<>
									<Loader2 className="size-4 animate-spin" />
									Deleting
								</>
							) : (
								"Delete"
							)}
						</Button>
					) : (
						<Button
							variant="outline"
							size={isInline ? "sm" : "default"}
							onClick={() => void handleCancel()}
							disabled={compose.isDeleting || compose.isSending || compose.isSaving}
						>
							Cancel
						</Button>
					)
				) : (
					<Button
						variant="outline"
						size={isInline ? "sm" : "default"}
						onClick={onClose}
						disabled={compose.isSending}
					>
						Cancel
					</Button>
				)}
				{showDraftActions ? (
					<Button
						variant="outline"
						size={isInline ? "sm" : "default"}
						onClick={() => void handleSave()}
						disabled={!compose.canSave || compose.isSaving || compose.isSending}
					>
						{compose.isSaving ? (
							<>
								<Loader2 className="size-4 animate-spin" />
								Saving
							</>
						) : (
							"Save"
						)}
					</Button>
				) : null}
				<Button
					size={isInline ? "sm" : "default"}
					onClick={() => void handleSend()}
					disabled={!canSend || compose.isSending || compose.isSaving}
				>
					{compose.isSending ? (
						<>
							<Loader2 className="size-4 animate-spin" />
							Sending
						</>
					) : (
						"Send"
					)}
				</Button>
			</div>
		</div>
	);

	const fields = (
		<div className={cn("space-y-3", !isInline && "overflow-auto p-4")}>
			{showToField ? (
				<div className="space-y-2">
					<label className="text-sm font-medium" htmlFor="compose-to">
						To
					</label>
					<Input
						id="compose-to"
						value={compose.fields.to}
						onChange={(event) =>
							compose.updateFields({ to: event.target.value })
						}
						placeholder="recipient@example.com"
					/>
				</div>
			) : null}
			{isReply && !showCcBccFields ? (
				<Button
					type="button"
					variant="link"
					size="sm"
					className="text-muted-foreground h-auto p-0"
					onClick={() => setShowCcBcc(true)}
				>
					Cc / Bcc
				</Button>
			) : null}
			{showCcBccFields ? (
				<>
					<div className="space-y-2">
						<label className="text-sm font-medium" htmlFor="compose-cc">
							Cc
						</label>
						<Input
							id="compose-cc"
							value={compose.fields.cc}
							onChange={(event) =>
								compose.updateFields({ cc: event.target.value })
							}
							placeholder={isReply ? "Optional" : undefined}
						/>
					</div>
					<div className="space-y-2">
						<label className="text-sm font-medium" htmlFor="compose-bcc">
							Bcc
						</label>
						<Input
							id="compose-bcc"
							value={compose.fields.bcc}
							onChange={(event) =>
								compose.updateFields({ bcc: event.target.value })
							}
							placeholder={isReply ? "Optional" : undefined}
						/>
					</div>
				</>
			) : null}
			{isReply ? (
				showSubjectEditor ? (
					<div className="space-y-2">
						<label className="text-sm font-medium" htmlFor="compose-subject">
							Subject
						</label>
						<Input
							id="compose-subject"
							value={compose.fields.subject}
							onChange={(event) =>
								compose.updateFields({ subject: event.target.value })
							}
						/>
					</div>
				) : (
					<Button
						type="button"
						variant="link"
						size="sm"
						className="text-muted-foreground h-auto p-0"
						onClick={() => setShowSubjectEditor(true)}
					>
						Change subject
					</Button>
				)
			) : (
				<div className="space-y-2">
					<label className="text-sm font-medium" htmlFor="compose-subject">
						Subject
					</label>
					<Input
						id="compose-subject"
						value={compose.fields.subject}
						onChange={(event) =>
							compose.updateFields({ subject: event.target.value })
						}
					/>
				</div>
			)}
			{compose.forwardSource ? (
				<ComposeForwardSource source={compose.forwardSource} />
			) : null}
			<div className="space-y-2">
				<label className="text-sm font-medium" htmlFor="compose-body">
					{compose.forwardSource ? "Message" : "Body"}
				</label>
				<Textarea
					id="compose-body"
					className={cn(isInline ? "min-h-[160px]" : "min-h-[280px]")}
					value={compose.fields.body}
					onChange={(event) =>
						compose.updateFields({ body: event.target.value })
					}
				/>
			</div>
			<ComposeAttachments
				attachments={compose.attachments}
				onChange={compose.updateAttachments}
				disabled={compose.isSending}
			/>
			{compose.saveError ? (
				<p className="text-destructive text-sm">{compose.saveError}</p>
			) : null}
			{compose.sendError ? (
				<p className="text-destructive text-sm">
					{getErrorMessage(compose.sendError)}
				</p>
			) : null}
			{compose.deleteError ? (
				<p className="text-destructive text-sm">
					{getErrorMessage(compose.deleteError)}
				</p>
			) : null}
		</div>
	);

	if (isInline) {
		return (
			<Card className="gap-0 rounded-lg p-4 py-4">
				{header}
				{fields}
			</Card>
		);
	}

	return (
		<div className="flex h-full flex-col">
			{header}
			{fields}
		</div>
	);
}
