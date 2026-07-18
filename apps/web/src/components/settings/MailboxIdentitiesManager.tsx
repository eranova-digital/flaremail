import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { IdentityForm } from "@/components/settings/IdentityForm";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	useCreateMailboxIdentity,
	useDeleteMailboxIdentity,
	useMailboxIdentities,
	useUpdateMailboxIdentity,
} from "@/hooks/use-identities";
import { getErrorMessage } from "@/lib/api/errors";
import {
	IDENTITY_NAME_PATTERN_OPTIONS,
	type IdentityInput,
} from "@/lib/identities/api";

type MailboxIdentitiesManagerProps = {
	mailboxId: string;
	title?: string;
	description?: string;
	/** When true, hide the instance default identity from the list. */
	hideDefault?: boolean;
};

export function MailboxIdentitiesManager({
	mailboxId,
	title = "Identities",
	description,
	hideDefault = false,
}: MailboxIdentitiesManagerProps) {
	const identitiesQuery = useMailboxIdentities(mailboxId);
	const createMutation = useCreateMailboxIdentity(mailboxId);
	const updateMutation = useUpdateMailboxIdentity(mailboxId);
	const deleteMutation = useDeleteMailboxIdentity(mailboxId);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (identitiesQuery.isLoading) {
		return (
			<div className="text-muted-foreground flex items-center gap-2 text-sm">
				<Loader2 className="size-4 animate-spin" aria-hidden />
				Loading identities…
			</div>
		);
	}

	if (identitiesQuery.isError || !identitiesQuery.data) {
		return (
			<Alert tone="destructive">
				{getErrorMessage(identitiesQuery.error) ??
					"Could not load identities."}
			</Alert>
		);
	}

	const { items: rawItems = [], capabilities } = identitiesQuery.data;
	const items = hideDefault
		? rawItems.filter((identity) => !identity.isDefault)
		: rawItems;
	const canManage = capabilities?.canManage ?? false;
	const allowCustom = capabilities?.customNameAllowed ?? false;
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
			{(title || description) && (
				<div>
					{title ? <h2 className="text-base font-medium">{title}</h2> : null}
					{description ? (
						<p className="text-muted-foreground text-sm">{description}</p>
					) : null}
				</div>
			)}

			{error ? <Alert tone="destructive">{error}</Alert> : null}

			{!canManage ? (
				<Alert>
					You can view these identities but cannot create or edit them.
				</Alert>
			) : null}

			<div className="space-y-3">
				{items.map((identity) => (
					<Card key={identity.id} className="rounded-xl shadow-sm">
						<CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
							<div>
								<CardTitle className="text-base">
									{identity.fromNamePreview || "(no name)"}
									{identity.isDefault ? (
										<span className="text-muted-foreground ml-2 text-xs font-normal">
											Default
										</span>
									) : null}
								</CardTitle>
								<p className="text-muted-foreground text-xs">
									{IDENTITY_NAME_PATTERN_OPTIONS.find(
										(option) => option.value === identity.namePattern,
									)?.label ?? identity.namePattern}
								</p>
							</div>
							{!identity.isDefault && canManage ? (
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
							{identity.signatureHtml ? (
								<div
									className="text-muted-foreground prose prose-sm max-w-none text-xs"
									dangerouslySetInnerHTML={{ __html: identity.signatureHtml }}
								/>
							) : (
								<p className="text-muted-foreground text-xs">No signature</p>
							)}
							{identity.isDefault ? (
								<p className="text-muted-foreground text-xs">
									Managed in Organization settings. Not editable here.
								</p>
							) : null}
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
				))}
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
		</section>
	);
}
