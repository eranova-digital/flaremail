import { Loader2, Send, Trash2, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { RecipientCombobox } from "@/components/compose/RecipientCombobox";
import { ComposeEditor } from "@/components/compose/ComposeEditor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	type ComposeForwardContext,
	type ComposeReplyContext,
	useComposeDraft,
} from "@/hooks/use-compose-draft";
import { useAvailableIdentities } from "@/hooks/use-identities";
import type { SendResult } from "@/lib/thread-messages-cache";
import { ComposeAttachments } from "@/components/compose/ComposeAttachments";
import { ComposeForwardSource } from "@/components/compose/ComposeForwardSource";
import { getErrorMessage } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth/AuthProvider";
import { resolveIdentitySignatureHtml } from "@/lib/identities/apply-signature";
import { useMailboxes } from "@/hooks/use-mailboxes";
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

function ComposeFieldRow({
	label,
	htmlFor,
	actions,
	children,
}: {
	label: string;
	htmlFor?: string;
	actions?: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 sm:px-4">
			<label
				htmlFor={htmlFor}
				className="text-muted-foreground w-14 shrink-0 text-sm"
			>
				{label}
			</label>
			<div className="min-w-0 flex-1">{children}</div>
			{actions ? <div className="flex shrink-0 items-center gap-0.5">{actions}</div> : null}
		</div>
	);
}

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
	const { t } = useTranslation("compose");
	const compose = useComposeDraft(mailboxId, {
		reply,
		forward,
		existingDraftId,
		threadId,
	});
	const { account } = useAuth();
	const mailboxesQuery = useMailboxes();
	const identitiesQuery = useAvailableIdentities(mailboxId);
	const isInline = variant === "inline";
	const isResumedDraft = Boolean(existingDraftId);
	const isForward = compose.isForwardMode;
	const showDraftActions = !isForward;
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

	const mailboxAddress =
		mailboxesQuery.data?.find((mailbox) => mailbox.id === mailboxId)?.address ??
		"";
	const primaryAddress =
		mailboxesQuery.data?.find(
			(mailbox) => mailbox.id === account?.primaryMailboxId,
		)?.address ?? mailboxAddress;

	const profile = {
		firstName: account?.profile?.firstName ?? "",
		lastName: account?.profile?.lastName ?? "",
	};

	const [showCc, setShowCc] = useState(false);
	const [showBcc, setShowBcc] = useState(false);
	const [showSubjectEditor, setShowSubjectEditor] = useState(false);
	/** `undefined` = don't sync (e.g. resumed draft already has signature in HTML). */
	const [signatureHtml, setSignatureHtml] = useState<string | null | undefined>(
		undefined,
	);

	useEffect(() => {
		const items = identitiesQuery.data;
		if (!items?.length || compose.fields.identityId) {
			return;
		}
		const first = items[0];
		if (!first) {
			return;
		}
		compose.updateFields({ identityId: first.id });
		setSignatureHtml(
			resolveIdentitySignatureHtml({
				identity: first,
				profile,
				mailboxAddress,
				primaryAddress,
			}),
		);
		// eslint-disable-next-line react-hooks/exhaustive-deps -- seed once when identities arrive
	}, [identitiesQuery.data]);

	const handleIdentityChange = (identityId: string) => {
		const identity = identitiesQuery.data?.find((item) => item.id === identityId);
		compose.updateFields({ identityId });
		setSignatureHtml(
			resolveIdentitySignatureHtml({
				identity,
				profile,
				mailboxAddress,
				primaryAddress,
			}),
		);
	};

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
	const showCcBccButtons = !showCcField || !showBccField;
	const canSend =
		Boolean(compose.fields.subject.trim()) &&
		(isReply || Boolean(compose.fields.to.trim()));
	const busy = compose.isDeleting || compose.isSending || compose.isSaving;

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

		try {
			await compose.removeDraft();
			setDeleteConfirmOpen(false);
			if (onDeleted) {
				onDeleted();
			} else {
				onClose();
			}
		} catch {
			// error surfaced via compose.deleteError
		}
	};

	const handleClose = () => {
		if (showDraftActions && !isResumedDraft) {
			void handleCancel();
			return;
		}
		if (showDraftActions && isResumedDraft) {
			onClose();
			return;
		}
		onClose();
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
					? t("loading.draft")
					: reply
						? t("loading.reply")
						: forward
							? t("loading.forward")
							: t("loading.generic")}
			</div>
		);
	}

	const headerTitle = existingDraftId
		? t("title.editDraft")
		: reply
			? isReplyAll
				? t("title.replyAll")
				: t("title.reply")
			: forward
				? t("title.forward")
				: t("title.newMessage");

	const ccBccActions = showCcBccButtons ? (
		<>
			{!showCcField ? (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="text-muted-foreground h-8 px-2"
					onClick={() => setShowCc(true)}
				>
					{t("fields.cc")}
				</Button>
			) : null}
			{!showBccField ? (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="text-muted-foreground h-8 px-2"
					onClick={() => setShowBcc(true)}
				>
					{t("fields.bcc")}
				</Button>
			) : null}
		</>
	) : null;

	const changeSubjectButton =
		isReply && !showSubjectEditor ? (
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="text-muted-foreground h-8 px-2"
				onClick={() => setShowSubjectEditor(true)}
			>
				{t("fields.changeSubject")}
			</Button>
		) : null;

	const replyMetaActions =
		!showToField && (showCcBccButtons || changeSubjectButton) ? (
			<>
				{ccBccActions}
				{changeSubjectButton}
			</>
		) : null;

	const hasFromField = Boolean(identitiesQuery.data && identitiesQuery.data.length > 0);

	const metaFields = (
		<div className="divide-border min-w-0 divide-y">
			{hasFromField ? (
				<ComposeFieldRow
					label={t("fields.from")}
					htmlFor="compose-identity"
					actions={replyMetaActions}
				>
					<Select
						value={compose.fields.identityId ?? undefined}
						onValueChange={handleIdentityChange}
					>
						<SelectTrigger
							id="compose-identity"
							aria-label={t("fields.fromIdentityAria")}
							className="h-9 min-w-0 border-0 bg-transparent px-0 shadow-none focus:ring-0"
						>
							<SelectValue placeholder={t("fields.selectIdentity")} />
						</SelectTrigger>
						<SelectContent>
							{identitiesQuery.data?.map((identity) => {
								const label = identity.fromNamePreview
									? `${identity.fromNamePreview} <${mailboxAddress}>`
									: mailboxAddress;
								return (
									<SelectItem key={identity.id} value={identity.id}>
										{identity.isDefault
											? t("fields.defaultIdentity", { label })
											: label}
									</SelectItem>
								);
							})}
						</SelectContent>
					</Select>
				</ComposeFieldRow>
			) : null}

			{showToField ? (
				<ComposeFieldRow
					label={t("fields.to")}
					htmlFor="compose-to"
					actions={ccBccActions}
				>
					<RecipientCombobox
						id="compose-to"
						plain
						value={compose.fields.to}
						onValueChange={(to) => compose.updateFields({ to })}
						placeholder={t("placeholders.to")}
					/>
				</ComposeFieldRow>
			) : null}

			{showCcField ? (
				<ComposeFieldRow label={t("fields.cc")} htmlFor="compose-cc">
					<RecipientCombobox
						id="compose-cc"
						plain
						value={compose.fields.cc}
						onValueChange={(cc) => compose.updateFields({ cc })}
						placeholder={
							isReply ? t("placeholders.optional") : t("placeholders.cc")
						}
						onEmptyBlur={() => setShowCc(false)}
					/>
				</ComposeFieldRow>
			) : null}

			{showBccField ? (
				<ComposeFieldRow label={t("fields.bcc")} htmlFor="compose-bcc">
					<RecipientCombobox
						id="compose-bcc"
						plain
						value={compose.fields.bcc}
						onValueChange={(bcc) => compose.updateFields({ bcc })}
						placeholder={
							isReply ? t("placeholders.optional") : t("placeholders.bcc")
						}
						onEmptyBlur={() => setShowBcc(false)}
					/>
				</ComposeFieldRow>
			) : null}

			{isReply ? (
				showSubjectEditor ? (
					<ComposeFieldRow label={t("fields.subject")} htmlFor="compose-subject">
						<Input
							id="compose-subject"
							value={compose.fields.subject}
							onChange={(event) =>
								compose.updateFields({ subject: event.target.value })
							}
							className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
						/>
					</ComposeFieldRow>
				) : null
			) : (
				<ComposeFieldRow label={t("fields.subject")} htmlFor="compose-subject">
					<Input
						id="compose-subject"
						value={compose.fields.subject}
						onChange={(event) =>
							compose.updateFields({ subject: event.target.value })
						}
						className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
					/>
				</ComposeFieldRow>
			)}
		</div>
	);

	const errors = (
		<>
			{compose.saveError ? (
				<p className="text-destructive px-3 text-sm sm:px-4">{compose.saveError}</p>
			) : null}
			{compose.sendError ? (
				<p className="text-destructive px-3 text-sm sm:px-4">
					{getErrorMessage(compose.sendError)}
				</p>
			) : null}
			{compose.deleteError ? (
				<p className="text-destructive px-3 text-sm sm:px-4">
					{getErrorMessage(compose.deleteError)}
				</p>
			) : null}
		</>
	);

	const titleBar = (
		<div
			className={cn(
				"flex items-center gap-2",
				isInline ? "px-3 pt-3 sm:px-4" : "border-b px-3 py-3 sm:px-4",
			)}
		>
			<h2 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight">
				{headerTitle}
			</h2>
			{!hasFromField ? (
				<div className="flex shrink-0 items-center gap-0.5">{replyMetaActions}</div>
			) : null}
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="size-8 shrink-0"
				aria-label={t("actions.close")}
				onClick={handleClose}
				disabled={compose.isSending || compose.isDeleting}
			>
				<X className="size-4" />
			</Button>
		</div>
	);

	const footer = (
		<div
			className={cn(
				"bg-background/95 supports-backdrop-filter:bg-background/80 flex flex-wrap items-center gap-2 border-t px-3 py-3 backdrop-blur sm:px-4",
				isInline && "rounded-b-lg",
			)}
		>
			{showDraftActions ? (
				isResumedDraft ? (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="text-destructive hover:text-destructive"
						onClick={() => setDeleteConfirmOpen(true)}
						disabled={busy}
					>
						{compose.isDeleting ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Trash2 className="size-4" />
						)}
						{compose.isDeleting ? t("actions.deleting") : t("actions.delete")}
					</Button>
				) : (
					<Button
						type="button"
						variant="ghost"
						onClick={() => void handleCancel()}
						disabled={busy}
					>
						{t("actions.discard")}
					</Button>
				)
			) : (
				<Button
					type="button"
					variant="ghost"
					onClick={onClose}
					disabled={compose.isSending}
				>
					{t("actions.discard")}
				</Button>
			)}

			{showDraftActions ? (
				<Button
					type="button"
					variant="outline"
					onClick={() => void handleSave()}
					disabled={!compose.canSave || compose.isSaving || compose.isSending}
				>
					{compose.isSaving ? (
						<>
							<Loader2 className="size-4 animate-spin" />
							{t("actions.saving")}
						</>
					) : (
						t("actions.saveDraft")
					)}
				</Button>
			) : null}

			<Button
				type="button"
				className="ml-auto"
				onClick={() => void handleSend()}
				disabled={!canSend || compose.isSending || compose.isSaving}
			>
				{compose.isSending ? (
					<>
						<Loader2 className="size-4 animate-spin" />
						{t("actions.sending")}
					</>
				) : (
					<>
						<Send className="size-4" />
						{t("actions.send")}
					</>
				)}
			</Button>
		</div>
	);

	const body = (
		<>
			{metaFields}
			{compose.forwardSource ? (
				<div className="border-border border-t px-3 py-3 sm:px-4">
					<ComposeForwardSource source={compose.forwardSource} />
				</div>
			) : null}
			<div className="border-border min-w-0 border-t">
				<ComposeEditor
					key={`${compose.draftId ?? "new"}-${compose.initialized}`}
					id="compose-body"
					mailboxId={mailboxId}
					flush
					className={cn(
						"min-w-0 rounded-none border-0 shadow-none",
						isInline ? "min-h-[12rem]" : "min-h-[min(24rem,50dvh)]",
					)}
					initialHtml={compose.fields.bodyHtml}
					signatureHtml={signatureHtml}
					placeholder={t("placeholders.body")}
					disabled={compose.isSending}
					onChange={({ html, text }) =>
						compose.updateFields({ bodyHtml: html, body: text })
					}
				/>
			</div>
			<div className="border-border border-t px-3 py-3 sm:px-4">
				<ComposeAttachments
					compact
					attachments={compose.attachments}
					onChange={compose.updateAttachments}
					disabled={compose.isSending}
				/>
			</div>
			{errors}
		</>
	);

	const confirmDeleteDialog = (
		<ConfirmDialog
			open={deleteConfirmOpen}
			onOpenChange={setDeleteConfirmOpen}
			title={t("confirm.deleteDraft.title")}
			description={t("confirm.deleteDraft.description")}
			confirmLabel={t("actions.delete")}
			pending={compose.isDeleting}
			onConfirm={() => {
				void handleDelete();
			}}
		/>
	);

	if (isInline) {
		return (
			<>
				<Card className="w-full min-w-0 max-w-full gap-0 overflow-x-clip rounded-lg py-0 shadow-sm">
					{titleBar}
					<div className="min-w-0">{body}</div>
					{footer}
				</Card>
				{confirmDeleteDialog}
			</>
		);
	}

	return (
		<>
			<div className="flex h-full min-w-0 flex-col">
				{titleBar}
				<div className="min-h-0 min-w-0 flex-1 overflow-auto">{body}</div>
				{footer}
			</div>
			{confirmDeleteDialog}
		</>
	);
}
