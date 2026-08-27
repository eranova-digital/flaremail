import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { RecipientCombobox } from "@/components/compose/RecipientCombobox";
import { ComposeEditor } from "@/components/compose/ComposeEditor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

		if (!window.confirm(t("confirm.deleteDraft"))) {
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

	const header = (
		<div
			className={cn(
				"flex gap-3",
				isInline
					? "mb-3 items-center justify-between"
					: "flex-col border-b px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4",
			)}
		>
			<h2 className={cn("min-w-0 truncate font-medium", isInline && "text-sm")}>
				{headerTitle}
			</h2>
			<div className="flex flex-wrap items-center gap-2">
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
									{t("actions.deleting")}
								</>
							) : (
								t("actions.delete")
							)}
						</Button>
					) : (
						<Button
							variant="outline"
							size={isInline ? "sm" : "default"}
							onClick={() => void handleCancel()}
							disabled={compose.isDeleting || compose.isSending || compose.isSaving}
						>
							{t("actions.cancel")}
						</Button>
					)
				) : (
					<Button
						variant="outline"
						size={isInline ? "sm" : "default"}
						onClick={onClose}
						disabled={compose.isSending}
					>
						{t("actions.cancel")}
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
								{t("actions.saving")}
							</>
						) : (
							t("actions.save")
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
							{t("actions.sending")}
						</>
					) : (
						t("actions.send")
					)}
				</Button>
			</div>
		</div>
	);

	const fields = (
		<div className="space-y-3">
			{identitiesQuery.data && identitiesQuery.data.length > 0 ? (
				<div className="space-y-2">
					<label className="text-sm font-medium" htmlFor="compose-identity">
						{t("fields.from")}
					</label>
					<Select
						value={compose.fields.identityId ?? undefined}
						onValueChange={handleIdentityChange}
					>
						<SelectTrigger
							id="compose-identity"
							aria-label={t("fields.fromIdentityAria")}
						>
							<SelectValue placeholder={t("fields.selectIdentity")} />
						</SelectTrigger>
						<SelectContent>
							{identitiesQuery.data.map((identity) => {
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
				</div>
			) : null}
			{showToField ? (
				<div className="space-y-2">
					<div className="flex items-center justify-between gap-2">
						<label className="text-sm font-medium" htmlFor="compose-to">
							{t("fields.to")}
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
										{t("fields.cc")}
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
										{t("fields.bcc")}
									</Button>
								) : null}
							</div>
						) : null}
					</div>
					<RecipientCombobox
						id="compose-to"
						value={compose.fields.to}
						onValueChange={(to) => compose.updateFields({ to })}
						placeholder={t("placeholders.to")}
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
							{t("fields.cc")}
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
							{t("fields.bcc")}
						</Button>
					) : null}
				</div>
			) : null}
			{showCcBccRow ? (
				<div className="flex flex-col gap-3 sm:flex-row">
					{showCcField ? (
						<div className="min-w-0 flex-1 space-y-2">
							<label className="text-sm font-medium" htmlFor="compose-cc">
								{t("fields.cc")}
							</label>
							<RecipientCombobox
								id="compose-cc"
								value={compose.fields.cc}
								onValueChange={(cc) => compose.updateFields({ cc })}
								placeholder={
									isReply ? t("placeholders.optional") : t("placeholders.cc")
								}
								onEmptyBlur={() => setShowCc(false)}
							/>
						</div>
					) : null}
					{showBccField ? (
						<div className="min-w-0 flex-1 space-y-2">
							<label className="text-sm font-medium" htmlFor="compose-bcc">
								{t("fields.bcc")}
							</label>
							<RecipientCombobox
								id="compose-bcc"
								value={compose.fields.bcc}
								onValueChange={(bcc) => compose.updateFields({ bcc })}
								placeholder={
									isReply ? t("placeholders.optional") : t("placeholders.bcc")
								}
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
							{t("fields.subject")}
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
						{t("fields.changeSubject")}
					</Button>
				)
			) : (
				<div className="space-y-2">
					<label className="text-sm font-medium" htmlFor="compose-subject">
						{t("fields.subject")}
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
					{compose.forwardSource ? t("fields.message") : t("fields.body")}
				</label>
				<ComposeEditor
					key={`${compose.draftId ?? "new"}-${compose.initialized}`}
					id="compose-body"
					mailboxId={mailboxId}
					className={cn(isInline ? "min-h-[160px]" : "min-h-[280px]")}
					initialHtml={compose.fields.bodyHtml}
					signatureHtml={signatureHtml}
					placeholder={t("placeholders.body")}
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
				<div className="p-3 sm:p-4">{fields}</div>
			</div>
		</div>
	);
}
