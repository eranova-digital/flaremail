import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	useCreateMailboxIdentity,
	useDeleteMailboxIdentity,
	useMailboxIdentities,
	useUpdateMailboxIdentity,
} from "@/hooks/use-identities";
import { getErrorMessage } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
	IDENTITY_NAME_PATTERN_OPTIONS,
	type Identity,
	type IdentityInput,
} from "@/lib/identities/api";
import type { IdentityNamePattern } from "@/lib/identities/name-pattern";

function IdentityForm({
	initial,
	allowCustom,
	busy,
	onSubmit,
	onCancel,
}: {
	initial?: Identity;
	allowCustom: boolean;
	busy: boolean;
	onSubmit: (input: IdentityInput) => void;
	onCancel: () => void;
}) {
	const [namePattern, setNamePattern] = useState<IdentityNamePattern>(
		initial?.namePattern ?? "first_name_last_name",
	);
	const [customName, setCustomName] = useState(initial?.customName ?? "");
	const [signatureHtml, setSignatureHtml] = useState(
		initial?.signatureHtml ?? "",
	);

	const patternOptions = IDENTITY_NAME_PATTERN_OPTIONS.filter(
		(option) => allowCustom || option.value !== "custom",
	);

	return (
		<div className="space-y-3 rounded-lg border p-4">
			<div className="space-y-2">
				<label htmlFor="identity-name-pattern" className="text-sm font-medium">
					Name pattern
				</label>
				<Select
					value={namePattern}
					onValueChange={(value) =>
						setNamePattern(value as IdentityNamePattern)
					}
					disabled={busy}
				>
					<SelectTrigger id="identity-name-pattern">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{patternOptions.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			{namePattern === "custom" ? (
				<div className="space-y-2">
					<label htmlFor="identity-custom-name" className="text-sm font-medium">
						Custom name
					</label>
					<Input
						id="identity-custom-name"
						value={customName}
						disabled={busy}
						onChange={(event) => setCustomName(event.target.value)}
					/>
				</div>
			) : null}
			<div className="space-y-2">
				<label htmlFor="identity-signature" className="text-sm font-medium">
					Signature (HTML)
				</label>
				<Textarea
					id="identity-signature"
					rows={4}
					value={signatureHtml}
					disabled={busy}
					placeholder="Optional signature appended when composing"
					onChange={(event) => setSignatureHtml(event.target.value)}
				/>
				<p className="text-muted-foreground text-xs">
					Tags: {"{from_name}"}, {"{first_name}"}, {"{last_name}"},{" "}
					{"{first_initial}"}, {"{last_initial}"}, {"{mailbox_address}"},{" "}
					{"{primary_address}"}
				</p>
			</div>
			<div className="flex gap-2">
				<Button
					disabled={busy || (namePattern === "custom" && !customName.trim())}
					onClick={() =>
						onSubmit({
							namePattern,
							customName: namePattern === "custom" ? customName : null,
							signatureHtml: signatureHtml.trim() || null,
						})
					}
				>
					{busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
					Save
				</Button>
				<Button variant="outline" disabled={busy} onClick={onCancel}>
					Cancel
				</Button>
			</div>
		</div>
	);
}

export function IdentitiesSection() {
	const { account } = useAuth();
	const mailboxId = account?.primaryMailboxId ?? null;
	const identitiesQuery = useMailboxIdentities(mailboxId);
	const createMutation = useCreateMailboxIdentity(mailboxId ?? "");
	const updateMutation = useUpdateMailboxIdentity(mailboxId ?? "");
	const deleteMutation = useDeleteMailboxIdentity(mailboxId ?? "");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!mailboxId) {
		return (
			<Alert>
				Identities are available for accounts with a primary mailbox.
			</Alert>
		);
	}

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

	const { items, capabilities } = identitiesQuery.data;
	const selfServe = capabilities.canManage;
	const allowCustom = capabilities.customNameAllowed;
	const busy =
		createMutation.isPending ||
		updateMutation.isPending ||
		deleteMutation.isPending;

	return (
		<section className="space-y-6">
			<div>
				<h2 className="text-lg font-medium">Identities</h2>
				<p className="text-muted-foreground text-sm">
					Choose how your name and signature appear when sending from your
					primary address. The From address always stays your mailbox.
				</p>
			</div>

			{error ? <Alert tone="destructive">{error}</Alert> : null}

			{!selfServe ? (
				<Alert>
					Identity self-serve is disabled. You can still select identities when
					composing; only administrators can add or edit them.
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
							{!identity.isDefault && selfServe ? (
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
					onSubmit={(input) => {
						setError(null);
						createMutation.mutate(input, {
							onSuccess: () => setCreating(false),
							onError: (err) => setError(getErrorMessage(err)),
						});
					}}
				/>
			) : selfServe ? (
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
