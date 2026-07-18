import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { IdentityForm } from "@/components/settings/IdentityForm";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	useAccountIdentities,
	useCreateMailboxIdentity,
	useDeleteMailboxIdentity,
	useUpdateMailboxIdentity,
} from "@/hooks/use-identities";
import { getErrorMessage } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
	IDENTITY_NAME_PATTERN_OPTIONS,
	type Identity,
	type IdentityInput,
} from "@/lib/identities/api";

function IdentityPreview({ identity }: { identity: Identity }) {
	return (
		<>
			{identity.signatureHtml ? (
				<div
					className="text-muted-foreground prose prose-sm max-w-none text-xs"
					dangerouslySetInnerHTML={{ __html: identity.signatureHtml }}
				/>
			) : (
				<p className="text-muted-foreground text-xs">No signature</p>
			)}
		</>
	);
}

function IdentityMeta({ identity }: { identity: Identity }) {
	return (
		<p className="text-muted-foreground text-xs">
			{IDENTITY_NAME_PATTERN_OPTIONS.find(
				(option) => option.value === identity.namePattern,
			)?.label ?? identity.namePattern}
		</p>
	);
}

export function IdentitiesSection() {
	const { account } = useAuth();
	const overviewQuery = useAccountIdentities();
	const primaryMailboxId =
		overviewQuery.data?.capabilities.primaryMailboxId ??
		account?.primaryMailboxId ??
		null;

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
						<Card key={identity.id} className="rounded-xl shadow-sm">
							<CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
								<div>
									<CardTitle className="text-base">
										{identity.fromNamePreview || "(no name)"}
									</CardTitle>
									<IdentityMeta identity={identity} />
								</div>
								{canManage ? (
									<div className="flex gap-1">
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
									</div>
								) : null}
							</CardHeader>
							<CardContent className="space-y-3">
								<IdentityPreview identity={identity} />
								{editingId === identity.id ? (
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
							</CardContent>
						</Card>
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
					<Card className="rounded-xl shadow-sm">
						<CardHeader className="pb-2">
							<CardTitle className="text-base">
								{defaultIdentity.fromNamePreview || "(no name)"}
								<span className="text-muted-foreground ml-2 text-xs font-normal">
									Default
								</span>
							</CardTitle>
							<IdentityMeta identity={defaultIdentity} />
						</CardHeader>
						<CardContent>
							<IdentityPreview identity={defaultIdentity} />
						</CardContent>
					</Card>
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
								<Card key={identity.id} className="rounded-xl shadow-sm">
									<CardHeader className="pb-2">
										<div className="flex flex-wrap items-center gap-2">
											<CardTitle className="text-base">
												{identity.fromNamePreview || "(no name)"}
											</CardTitle>
											{group.identityExport ? (
												<Badge variant="secondary">
													Usable outside this mailbox
												</Badge>
											) : null}
										</div>
										<IdentityMeta identity={identity} />
										{!group.identityExport ? (
											<p className="text-muted-foreground text-xs">
												Only when sending from {group.mailboxAddress}
											</p>
										) : null}
									</CardHeader>
									<CardContent>
										<IdentityPreview identity={identity} />
									</CardContent>
								</Card>
							))}
						</div>
					))
				)}
			</div>
		</section>
	);
}
