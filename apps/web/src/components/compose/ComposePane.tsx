import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { RecipientCombobox } from "@/components/compose/RecipientCombobox";
import { ComposeEditor } from "@/components/compose/ComposeEditor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
	const hasCc = Boolean(compose.fields.cc.trim());
	const hasBcc = Boolean(compose.fields.bcc.trim());
	const [showCc, setShowCc] = useState(false);
	const [showBcc, setShowBcc] = useState(false);
	const [showSubjectEditor, setShowSubjectEditor] = useState(false);

	useEffect(() => {
		if (hasCc) {
			setShowCc(true);
		}
	}, [hasCc]);

	useEffect(() => {
		if (hasBcc) {
			setShowBcc(true);
		}
	}, [hasBcc]);

	const showToField = !isReply;
	const showCcField = showCc || hasCc;
	const showBccField = showBcc || hasBcc;
	const showCcBccRow = showCcField || showBccField;
	const showCcBccButtons = !showCcField || !showBccField;
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
		<div className="space-y-3">
			{showToField ? (
				<div className="space-y-2">
					<div className="flex items-center justify-between gap-2">
						<label className="text-sm font-medium" htmlFor="compose-to">
							To
						</label>
						{showCcBccButtons ? (
							<div className="flex items-center gap-1">
								{!showCcField ? (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="text-muted-foreground h-7 px-2"
										onClick={() => setShowCc(true)}
									>
										Cc
									</Button>
								) : null}
								{!showBccField ? (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="text-muted-foreground h-7 px-2"
										onClick={() => setShowBcc(true)}
									>
										Bcc
									</Button>
								) : null}
							</div>
						) : null}
					</div>
					<RecipientCombobox
						id="compose-to"
						value={compose.fields.to}
						onValueChange={(to) => compose.updateFields({ to })}
						placeholder="recipient@example.com"
					/>
				</div>
			) : null}
			{!showToField && showCcBccButtons ? (
				<div className="flex items-center gap-1">
					{!showCcField ? (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="text-muted-foreground h-7 px-2"
							onClick={() => setShowCc(true)}
						>
							Cc
						</Button>
					) : null}
					{!showBccField ? (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="text-muted-foreground h-7 px-2"
							onClick={() => setShowBcc(true)}
						>
							Bcc
						</Button>
					) : null}
				</div>
			) : null}
			{showCcBccRow ? (
				<div className="flex gap-3">
					{showCcField ? (
						<div className="min-w-0 flex-1 space-y-2">
							<label className="text-sm font-medium" htmlFor="compose-cc">
								Cc
							</label>
							<RecipientCombobox
								id="compose-cc"
								value={compose.fields.cc}
								onValueChange={(cc) => compose.updateFields({ cc })}
								placeholder={isReply ? "Optional" : "cc@example.com"}
								onEmptyBlur={() => setShowCc(false)}
							/>
						</div>
					) : null}
					{showBccField ? (
						<div className="min-w-0 flex-1 space-y-2">
							<label className="text-sm font-medium" htmlFor="compose-bcc">
								Bcc
							</label>
							<RecipientCombobox
								id="compose-bcc"
								value={compose.fields.bcc}
								onValueChange={(bcc) => compose.updateFields({ bcc })}
								placeholder={isReply ? "Optional" : "bcc@example.com"}
								onEmptyBlur={() => setShowBcc(false)}
							/>
						</div>
					) : null}
				</div>
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
				<ComposeEditor
					key={`${compose.draftId ?? "new"}-${compose.initialized}`}
					id="compose-body"
					className={cn(isInline ? "min-h-[160px]" : "min-h-[280px]")}
					initialHtml={compose.fields.bodyHtml}
					placeholder="Write your message…"
					disabled={compose.isSending}
					onChange={({ html, text }) =>
						compose.updateFields({ bodyHtml: html, body: text })
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
			<div className="min-h-0 flex-1 overflow-auto">
				<div className="p-4">{fields}</div>
			</div>
		</div>
	);
}
