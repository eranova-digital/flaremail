import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

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
		return (
			<Alert>
				Identities are available for accounts with a primary mailbox.
			</Alert>
		);
	}

	if (overviewQuery.isLoading) {
		return (
			<div className="text-muted-foreground flex items-center gap-2 text-sm">
				<Loader2 className="size-4 animate-spin" aria-hidden />
				Loading identities…
			</div>
		);
	}

	if (overviewQuery.isError || !overviewQuery.data || !primaryMailboxId) {
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
				<h2 className="text-base font-medium">Identities</h2>
				<p className="text-muted-foreground text-sm">
					How your name and signature appear when sending. The From address
					always stays the mailbox you send from.
				</p>
			</div>

			{error ? <Alert tone="destructive">{error}</Alert> : null}

			{!canManage ? (
				<Alert>
					You can view these identities but cannot create or edit your own.
				</Alert>
			) : null}

			<div className="space-y-3">
				<div>
					<h3 className="text-sm font-medium">Your identities</h3>
					<p className="text-muted-foreground text-xs">
						Owned by your primary mailbox.
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
						<h3 className="text-sm font-medium">Default identity</h3>
						<p className="text-muted-foreground text-xs">
							Instance-wide template used when sending from your primary
							mailbox. Managed in Organization settings.
						</p>
					</div>
					<IdentityCard
						identity={defaultIdentity}
						mailboxAddress={primaryAddress}
						description="Managed in Organization settings. Not editable here."
					/>
				</div>
			) : null}

			<div className="space-y-3">
				<div>
					<h3 className="text-sm font-medium">Shared mailbox identities</h3>
					<p className="text-muted-foreground text-xs">
						Identities from shared mailboxes you can access. Managed by mailbox
						managers.
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
									badges={
										group.identityExport ? (
											<Badge variant="outline">
												Usable outside this mailbox
											</Badge>
										) : undefined
									}
									description={
										group.identityExport
											? undefined
											: `Only when sending from ${group.mailboxAddress}`
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
