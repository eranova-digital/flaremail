import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { IdentityCard } from "@/components/settings/IdentityCard";
import { IdentityForm } from "@/components/settings/IdentityForm";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	useAccountIdentities,
	useCreateMailboxIdentity,
	useDeleteMailboxIdentity,
	useUpdateMailboxIdentity,
} from "@/hooks/use-identities";
import { getErrorMessage } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { IdentityInput } from "@/lib/identities/api";

export function IdentitiesSection() {
	const { t } = useTranslation("settings");
	const { t: tm } = useTranslation("management");
	const { account } = useAuth();
	const overviewQuery = useAccountIdentities();
	const primaryMailboxId =
		overviewQuery.data?.capabilities.primaryMailboxId ??
		account?.primaryMailboxId ??
		null;
	const primaryAddress = account?.loginIdentifier ?? null;

	const createMutation = useCreateMailboxIdentity(primaryMailboxId ?? "");
	const updateMutation = useUpdateMailboxIdentity(primaryMailboxId ?? "");
	const deleteMutation = useDeleteMailboxIdentity(primaryMailboxId ?? "");

	const [editingId, setEditingId] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!account?.primaryMailboxId && !overviewQuery.isLoading) {
		return <Alert>{t("identities.noPrimaryMailbox")}</Alert>;
	}

	if (overviewQuery.isLoading) {
		return (
			<div className="text-muted-foreground flex items-center gap-2 text-sm">
				<Loader2 className="size-4 animate-spin" aria-hidden />
				{t("identities.loading")}
			</div>
		);
	}

	if (overviewQuery.isError || !overviewQuery.data || !primaryMailboxId) {
		return (
			<Alert tone="destructive">
				{getErrorMessage(overviewQuery.error) ?? t("identities.loadError")}
			</Alert>
		);
	}

	const { own, default: defaultIdentity, shared, capabilities } =
		overviewQuery.data;
	const canManage = capabilities.canManageOwn;
	const allowCustom = capabilities.customNameAllowed;
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
		<section className="space-y-8">
			<div>
				<h2 className="text-base font-medium">{t("identities.title")}</h2>
				<p className="text-muted-foreground text-sm">
					{t("identities.description")}
				</p>
			</div>

			{error ? <Alert tone="destructive">{error}</Alert> : null}

			{!canManage ? <Alert>{t("identities.viewOnlyAlert")}</Alert> : null}

			<div className="space-y-3">
				<div>
					<h3 className="text-sm font-medium">{t("identities.yourIdentities")}</h3>
					<p className="text-muted-foreground text-xs">
						{t("identities.yourIdentitiesHint")}
					</p>
				</div>
				{own.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("identities.emptyOwn")}
					</p>
				) : (
					own.map((identity) => (
						<IdentityCard
							key={identity.id}
							identity={identity}
							mailboxAddress={primaryAddress}
							actions={
								canManage ? (
									<>
										<Button
											size="icon"
											variant="ghost"
											aria-label={t("identities.editAria")}
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
											aria-label={t("identities.deleteAria")}
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
							footer={
								editingId === identity.id ? (
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
								) : undefined
							}
						/>
					))
				)}
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
						{t("identities.add")}
					</Button>
				) : null}
			</div>

			{defaultIdentity ? (
				<div className="space-y-3">
					<div>
						<h3 className="text-sm font-medium">
							{t("identities.defaultTitle")}
						</h3>
						<p className="text-muted-foreground text-xs">
							{tm("accounts.identities.defaultDesc")}
						</p>
					</div>
					<IdentityCard
						identity={defaultIdentity}
						mailboxAddress={primaryAddress}
						description={
							<Link
								to="/management?tab=organization#default-identity"
								className="hover:text-foreground underline-offset-2 hover:underline"
							>
								{t("identities.defaultCardDescription")}
							</Link>
						}
					/>
				</div>
			) : null}

			<div className="space-y-3">
				<div>
					<h3 className="text-sm font-medium">{t("identities.sharedTitle")}</h3>
					<p className="text-muted-foreground text-xs">
						{t("identities.sharedHint")}
					</p>
				</div>
				{shared.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("identities.emptyShared")}
					</p>
				) : (
					shared.map((group) => (
						<div key={group.mailboxId} className="space-y-2">
							<p className="text-sm font-medium">{group.mailboxAddress}</p>
							{group.identities.map((identity) => (
								<IdentityCard
									key={identity.id}
									identity={identity}
									mailboxAddress={group.mailboxAddress}
									badges={
										group.identityExport ? (
											<Badge variant="outline">
												{t("identities.usableOutsideMailbox")}
											</Badge>
										) : undefined
									}
									description={
										group.identityExport
											? undefined
											: t("identities.onlyWhenSendingFrom", {
													mailboxAddress: group.mailboxAddress,
												})
									}
								/>
							))}
						</div>
					))
				)}
			</div>
		</section>
	);
}
