import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

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
				Loading identities…
			</div>
		);
	}

	if (overviewQuery.isError || !overviewQuery.data) {
		return (
			<Alert tone="destructive">
				{getErrorMessage(overviewQuery.error) ??
					"Could not load identities."}
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
				<h3 className="text-sm font-medium">Identities</h3>
				<p className="text-muted-foreground text-xs">
					Send personas {displayName} can use. Own identities can be edited
					here; default and shared identities are managed elsewhere.
				</p>
			</div>

			{error ? <Alert tone="destructive">{error}</Alert> : null}

			{!canManage ? (
				<Alert>
					You can view these identities but cannot create or edit this
					account&apos;s own identities.
				</Alert>
			) : null}

			<div className="space-y-3">
				<div>
					<h4 className="text-sm font-medium">Own identities</h4>
					<p className="text-muted-foreground text-xs">
						Owned by {displayName}&apos;s primary mailbox.
					</p>
				</div>
				{own.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No personal identities yet.
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
											aria-label="Edit identity"
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
											aria-label="Delete identity"
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
						Add identity
					</Button>
				) : null}
			</div>

			{defaultIdentity ? (
				<div className="space-y-3">
					<div>
						<h4 className="text-sm font-medium">Default identity</h4>
						<p className="text-muted-foreground text-xs">
							Instance-wide template used when sending from a primary mailbox.
						</p>
					</div>
					<IdentityCard
						identity={defaultIdentity}
						mailboxAddress={primaryAddress}
						disabled
						description="Managed in Organization settings."
						actions={
							<Button variant="outline" size="sm" asChild>
								<Link to="/management?tab=organization#default-identity">
									Organization
									<ArrowUpRight className="size-3.5" aria-hidden />
								</Link>
							</Button>
						}
					/>
				</div>
			) : null}

			<div className="space-y-3">
				<div>
					<h4 className="text-sm font-medium">Shared mailbox identities</h4>
					<p className="text-muted-foreground text-xs">
						Identities from shared mailboxes this account can access.
					</p>
				</div>
				{shared.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No shared mailbox identities.
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
												Usable outside this mailbox
											</Badge>
										) : undefined
									}
									description={
										group.identityExport
											? "Managed on the shared mailbox."
											: `Only when sending from ${group.mailboxAddress}`
									}
									actions={
										<Button variant="outline" size="sm" asChild>
											<Link
												to={`/management/mailboxes/${group.mailboxId}/users?tab=identities`}
											>
												Manage
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
