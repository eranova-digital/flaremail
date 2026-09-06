import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { IdentityCard } from "@/components/settings/IdentityCard";
import { IdentityForm } from "@/components/settings/IdentityForm";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	useCreateMailboxIdentity,
	useDeleteMailboxIdentity,
	useMailboxIdentities,
	useUpdateMailboxIdentity,
} from "@/hooks/use-identities";
import { getErrorMessage } from "@/lib/api/errors";
import type { IdentityInput } from "@/lib/identities/api";

type MailboxIdentitiesManagerProps = {
	mailboxId: string;
	mailboxAddress?: string | null;
	title?: string;
	description?: string;
	/** When true, hide the instance default identity from the list. */
	hideDefault?: boolean;
};

export function MailboxIdentitiesManager({
	mailboxId,
	mailboxAddress,
	title,
	description,
	hideDefault = false,
}: MailboxIdentitiesManagerProps) {
	const { t } = useTranslation("management");
	const identitiesQuery = useMailboxIdentities(mailboxId);
	const createMutation = useCreateMailboxIdentity(mailboxId);
	const updateMutation = useUpdateMailboxIdentity(mailboxId);
	const deleteMutation = useDeleteMailboxIdentity(mailboxId);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const resolvedTitle = title ?? t("accounts.identities.defaultTitle");

	if (identitiesQuery.isLoading) {
		return (
			<div className="text-muted-foreground flex items-center gap-2 text-sm">
				<Loader2 className="size-4 animate-spin" aria-hidden />
				{t("accounts.identities.loading")}
			</div>
		);
	}

	if (identitiesQuery.isError || !identitiesQuery.data) {
		return (
			<Alert tone="destructive">
				{getErrorMessage(identitiesQuery.error) ??
					t("accounts.identities.loadError")}
			</Alert>
		);
	}

	const rawItems = Array.isArray(identitiesQuery.data.items)
		? identitiesQuery.data.items
		: [];
	const items = hideDefault
		? rawItems.filter((identity) => !identity.isDefault)
		: rawItems;
	const canManage = identitiesQuery.data.capabilities?.canManage ?? false;
	const allowCustom =
		identitiesQuery.data.capabilities?.customNameAllowed ?? false;
	const busy =
		createMutation.isPending ||
		updateMutation.isPending ||
		deleteMutation.isPending;

	const submitCreate = (input: IdentityInput) => {
		setError(null);
		createMutation.mutate(input, {
			onSuccess: () => setCreating(false),
			onError: (err) => setError(getErrorMessage(err)),
		});
	};

	return (
		<section className="space-y-4">
			{(resolvedTitle || description) && (
				<div>
					{resolvedTitle ? (
						<h2 className="text-base font-medium">{resolvedTitle}</h2>
					) : null}
					{description ? (
						<p className="text-muted-foreground text-sm">{description}</p>
					) : null}
				</div>
			)}

			{error ? <Alert tone="destructive">{error}</Alert> : null}

			{!canManage ? (
				<Alert>{t("accounts.identities.viewOnly")}</Alert>
			) : null}

			<div className="space-y-3">
				{items.map((identity) => {
					const isEditing = editingId === identity.id;
					const showDefaultNote = identity.isDefault;
					const footer =
						showDefaultNote || isEditing ? (
							<>
								{showDefaultNote ? (
									<p className="text-muted-foreground text-xs">
										{t("accounts.identities.managedInOrg")}
									</p>
								) : null}
								{isEditing ? (
									<IdentityForm
										initial={identity}
										allowCustom={allowCustom}
										busy={busy}
										onCancel={() => setEditingId(null)}
										onSubmit={(input) => {
											setError(null);
											updateMutation.mutate(
												{ identityId: identity.id, input },
												{
													onSuccess: () => setEditingId(null),
													onError: (err) => setError(getErrorMessage(err)),
												},
											);
										}}
									/>
								) : null}
							</>
						) : undefined;

					return (
						<IdentityCard
							key={identity.id}
							identity={identity}
							mailboxAddress={mailboxAddress}
							actions={
								!identity.isDefault && canManage ? (
									<>
										<Button
											size="icon"
											variant="ghost"
											aria-label={t("accounts.identities.editAria")}
											disabled={busy}
											onClick={() => {
												setCreating(false);
												setEditingId(identity.id);
											}}
										>
											<Pencil className="size-4" />
										</Button>
										<Button
											size="icon"
											variant="ghost"
											aria-label={t("accounts.identities.deleteAria")}
											disabled={busy}
											onClick={() => {
												setError(null);
												deleteMutation.mutate(identity.id, {
													onError: (err) => setError(getErrorMessage(err)),
												});
											}}
										>
											<Trash2 className="size-4" />
										</Button>
									</>
								) : undefined
							}
							footer={footer}
						/>
					);
				})}
			</div>

			{creating ? (
				<IdentityForm
					allowCustom={allowCustom}
					busy={busy}
					onCancel={() => setCreating(false)}
					onSubmit={submitCreate}
				/>
			) : canManage ? (
				<Button
					variant="secondary"
					disabled={busy}
					onClick={() => {
						setEditingId(null);
						setCreating(true);
					}}
				>
					<Plus className="size-4" aria-hidden />
					{t("accounts.identities.add")}
				</Button>
			) : null}
		</section>
	);
}
