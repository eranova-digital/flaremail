import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { IdentityCard } from "@/components/settings/IdentityCard";
import { IdentityForm } from "@/components/settings/IdentityForm";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	useAccountIdentitiesForAccount,
	useCreateMailboxIdentity,
	useDeleteMailboxIdentity,
	useUpdateMailboxIdentity,
} from "@/hooks/use-identities";
import { getErrorMessage } from "@/lib/api/errors";
import type { IdentityInput } from "@/lib/identities/api";

type AccountIdentitiesTabProps = {
	accountId: string;
	mailboxId: string;
	mailboxAddress: string;
	displayName: string;
};

export function AccountIdentitiesTab({
	accountId,
	mailboxId,
	mailboxAddress,
	displayName,
}: AccountIdentitiesTabProps) {
	const { t } = useTranslation("management");
	const overviewQuery = useAccountIdentitiesForAccount(accountId);
	const createMutation = useCreateMailboxIdentity(mailboxId);
	const updateMutation = useUpdateMailboxIdentity(mailboxId);
	const deleteMutation = useDeleteMailboxIdentity(mailboxId);

	const [editingId, setEditingId] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (overviewQuery.isLoading) {
		return (
			<div className="text-muted-foreground flex items-center gap-2 text-sm">
				<Loader2 className="size-4 animate-spin" aria-hidden />
				{t("accounts.identities.loading")}
			</div>
		);
	}

	if (overviewQuery.isError || !overviewQuery.data) {
		return (
			<Alert tone="destructive">
				{getErrorMessage(overviewQuery.error) ?? t("accounts.identities.loadError")}
			</Alert>
		);
	}

	const { own, default: defaultIdentity, shared, capabilities } =
		overviewQuery.data;
	const canManage = capabilities.canManageOwn;
	const allowCustom = capabilities.customNameAllowed;
	const primaryAddress = mailboxAddress;
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
		<div className="space-y-8">
			<div>
				<h3 className="text-sm font-medium">{t("accounts.identities.title")}</h3>
				<p className="text-muted-foreground text-xs">
					{t("accounts.identities.description", { name: displayName })}
				</p>
			</div>

			{error ? <Alert tone="destructive">{error}</Alert> : null}

			{!canManage ? (
				<Alert>{t("accounts.identities.viewOnly")}</Alert>
			) : null}

			<div className="space-y-3">
				<div>
					<h4 className="text-sm font-medium">{t("accounts.identities.ownTitle")}</h4>
					<p className="text-muted-foreground text-xs">
						{t("accounts.identities.ownDesc", { name: displayName })}
					</p>
				</div>
				{own.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("accounts.identities.ownEmpty")}
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
						variant="outline"
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
			</div>

			{defaultIdentity ? (
				<div className="space-y-3">
					<div>
						<h4 className="text-sm font-medium">
							{t("accounts.identities.defaultTitle")}
						</h4>
						<p className="text-muted-foreground text-xs">
							{t("accounts.identities.defaultDesc")}
						</p>
					</div>
					<IdentityCard
						identity={defaultIdentity}
						mailboxAddress={primaryAddress}
						disabled
						description={t("accounts.identities.managedInOrg")}
						actions={
							<Button variant="outline" size="sm" asChild>
								<Link to="/management?tab=organization#default-identity">
									{t("accounts.identities.organizationLink")}
									<ArrowUpRight className="size-3.5" aria-hidden />
								</Link>
							</Button>
						}
					/>
				</div>
			) : null}

			<div className="space-y-3">
				<div>
					<h4 className="text-sm font-medium">{t("accounts.identities.sharedTitle")}</h4>
					<p className="text-muted-foreground text-xs">
						{t("accounts.identities.sharedDesc")}
					</p>
				</div>
				{shared.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("accounts.identities.sharedEmpty")}
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
									disabled
									badges={
										group.identityExport ? (
											<Badge variant="outline">
												{t("accounts.identities.usableOutside")}
											</Badge>
										) : undefined
									}
									description={
										group.identityExport
											? t("accounts.identities.managedOnShared")
											: t("accounts.identities.onlyWhenSending", {
													address: group.mailboxAddress,
												})
									}
									actions={
										<Button variant="outline" size="sm" asChild>
											<Link
												to={`/management/mailboxes/${group.mailboxId}/users?tab=identities`}
											>
												{t("accounts.identities.manage")}
												<ArrowUpRight className="size-3.5" aria-hidden />
											</Link>
										</Button>
									}
								/>
							))}
						</div>
					))
				)}
			</div>
		</div>
	);
}
