import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2, Plus, Trash2 } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/api/errors";
import {
	adminRevokeOidcClientGrant,
	createOidcClient,
	deleteOidcClient,
	listOidcClientGrants,
	listOidcClients,
	OIDC_SCOPE_OPTIONS,
	regenerateOidcClientSecret,
	updateOidcClient,
	type OidcClient,
	type OidcClientGrant,
} from "@/lib/oidc/api";

type EditorState = {
	name: string;
	redirectUrisText: string;
	allowedScopes: string[];
	m2mPermissionsText: string;
	isConfidential: boolean;
	requireConsent: boolean;
};

const emptyEditor = (): EditorState => ({
	name: "",
	redirectUrisText: "",
	allowedScopes: ["openid", "profile", "email"],
	m2mPermissionsText: "",
	isConfidential: true,
	requireConsent: true,
});

function parseLines(value: string): string[] {
	return value
		.split(/[\n,]+/)
		.map((line) => line.trim())
		.filter(Boolean);
}

export function OidcClientsSection() {
	const [clients, setClients] = useState<OidcClient[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [editorOpen, setEditorOpen] = useState(false);
	const [editing, setEditing] = useState<OidcClient | null>(null);
	const [editor, setEditor] = useState<EditorState>(emptyEditor);
	const [submitting, setSubmitting] = useState(false);
	const [secretReveal, setSecretReveal] = useState<string | null>(null);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [grantsClient, setGrantsClient] = useState<OidcClient | null>(null);
	const [grants, setGrants] = useState<OidcClientGrant[]>([]);
	const [grantsLoading, setGrantsLoading] = useState(false);

	const reload = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const result = await listOidcClients();
			setClients(result.clients);
		} catch (loadError) {
			setError(getErrorMessage(loadError));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void reload();
	}, [reload]);

	const openCreate = () => {
		setEditing(null);
		setEditor(emptyEditor());
		setEditorOpen(true);
	};

	const openEdit = (client: OidcClient) => {
		setEditing(client);
		setEditor({
			name: client.name,
			redirectUrisText: client.redirectUris.join("\n"),
			allowedScopes: [...client.allowedScopes],
			m2mPermissionsText: client.m2mPermissions.join("\n"),
			isConfidential: client.isConfidential,
			requireConsent: client.requireConsent,
		});
		setEditorOpen(true);
	};

	const toggleScope = (scope: string, checked: boolean) => {
		setEditor((current) => ({
			...current,
			allowedScopes: checked
				? [...new Set([...current.allowedScopes, scope])]
				: current.allowedScopes.filter((item) => item !== scope),
		}));
	};

	const handleSave = async () => {
		setSubmitting(true);
		setError(null);
		try {
			const payload = {
				name: editor.name.trim(),
				redirectUris: parseLines(editor.redirectUrisText),
				allowedScopes: editor.allowedScopes,
				m2mPermissions: parseLines(editor.m2mPermissionsText),
				isConfidential: editor.isConfidential,
				requireConsent: editor.requireConsent,
			};
			if (editing) {
				await updateOidcClient(editing.id, payload);
			} else {
				const created = await createOidcClient(payload);
				if (created.clientSecret) {
					setSecretReveal(created.clientSecret);
				}
			}
			setEditorOpen(false);
			await reload();
		} catch (saveError) {
			setError(getErrorMessage(saveError));
		} finally {
			setSubmitting(false);
		}
	};

	const handleDelete = async () => {
		if (!deleteId) {
			return;
		}
		setSubmitting(true);
		try {
			await deleteOidcClient(deleteId);
			setDeleteId(null);
			await reload();
		} catch (deleteError) {
			setError(getErrorMessage(deleteError));
		} finally {
			setSubmitting(false);
		}
	};

	const handleRegenerate = async (client: OidcClient) => {
		setSubmitting(true);
		setError(null);
		try {
			const result = await regenerateOidcClientSecret(client.id);
			setSecretReveal(result.clientSecret);
		} catch (regenError) {
			setError(getErrorMessage(regenError));
		} finally {
			setSubmitting(false);
		}
	};

	const openGrants = async (client: OidcClient) => {
		setGrantsClient(client);
		setGrantsLoading(true);
		setError(null);
		try {
			const result = await listOidcClientGrants(client.id);
			setGrants(result.grants);
		} catch (grantsError) {
			setError(getErrorMessage(grantsError));
			setGrantsClient(null);
		} finally {
			setGrantsLoading(false);
		}
	};

	const revokeGrant = async (accountId: string) => {
		if (!grantsClient) {
			return;
		}
		setSubmitting(true);
		try {
			await adminRevokeOidcClientGrant(grantsClient.id, accountId);
			const result = await listOidcClientGrants(grantsClient.id);
			setGrants(result.grants);
		} catch (revokeError) {
			setError(getErrorMessage(revokeError));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 className="text-lg font-semibold">OIDC clients</h2>
					<p className="text-muted-foreground max-w-prose text-sm">
						Register relying parties for SSO and machine-to-machine access.
					</p>
				</div>
				<Button type="button" onClick={openCreate}>
					<Plus className="size-4" />
					Add client
				</Button>
			</div>

			{error ? <Alert tone="destructive">{error}</Alert> : null}

			{loading ? (
				<div className="space-y-2">
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-24 w-full" />
				</div>
			) : clients.length === 0 ? (
				<p className="text-muted-foreground text-sm">No OIDC clients yet.</p>
			) : (
				<div className="space-y-3">
					{clients.map((client) => (
						<Card key={client.id}>
							<CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
								<div>
									<CardTitle className="text-base">{client.name}</CardTitle>
									<p className="text-muted-foreground mt-1 font-mono text-xs">
										{client.clientId}
									</p>
								</div>
								<div className="flex flex-wrap gap-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => void openGrants(client)}
									>
										Grants
									</Button>
									{client.isConfidential ? (
										<Button
											type="button"
											variant="outline"
											size="sm"
											disabled={submitting}
											onClick={() => void handleRegenerate(client)}
										>
											Regenerate secret
										</Button>
									) : null}
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => openEdit(client)}
									>
										Edit
									</Button>
									<Button
										type="button"
										variant="destructive"
										size="sm"
										onClick={() => setDeleteId(client.id)}
									>
										<Trash2 className="size-4" />
									</Button>
								</div>
							</CardHeader>
							<CardContent className="text-muted-foreground space-y-1 text-sm">
								<p>
									{client.isConfidential ? "Confidential" : "Public"} · Consent{" "}
									{client.requireConsent ? "required" : "skipped"}
								</p>
								<p>Redirect URIs: {client.redirectUris.join(", ") || "—"}</p>
								<p>Scopes: {client.allowedScopes.join(" ")}</p>
								{client.m2mPermissions.length > 0 ? (
									<p>M2M: {client.m2mPermissions.join(" ")}</p>
								) : null}
							</CardContent>
						</Card>
					))}
				</div>
			)}

			<Dialog open={editorOpen} onOpenChange={setEditorOpen}>
				<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>{editing ? "Edit OIDC client" : "Add OIDC client"}</DialogTitle>
						<DialogDescription>
							Configure redirect URIs, scopes, and consent for this relying party.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<label className="block space-y-1.5 text-sm">
							<span className="font-medium">Name</span>
							<Input
								value={editor.name}
								onChange={(event) =>
									setEditor((current) => ({ ...current, name: event.target.value }))
								}
							/>
						</label>
						<label className="block space-y-1.5 text-sm">
							<span className="font-medium">Redirect URIs (one per line)</span>
							<textarea
								className="border-input bg-background min-h-24 w-full rounded-md border px-3 py-2 text-sm"
								value={editor.redirectUrisText}
								onChange={(event) =>
									setEditor((current) => ({
										...current,
										redirectUrisText: event.target.value,
									}))
								}
							/>
						</label>
						<div className="space-y-2">
							<p className="text-sm font-medium">Allowed scopes</p>
							{OIDC_SCOPE_OPTIONS.map((scope) => (
								<label key={scope} className="flex items-center gap-2 text-sm">
									<Checkbox
										checked={editor.allowedScopes.includes(scope)}
										onCheckedChange={(checked) =>
											toggleScope(scope, checked === true)
										}
									/>
									{scope}
								</label>
							))}
						</div>
						<label className="block space-y-1.5 text-sm">
							<span className="font-medium">M2M permissions (one per line)</span>
							<textarea
								className="border-input bg-background min-h-20 w-full rounded-md border px-3 py-2 text-sm"
								value={editor.m2mPermissionsText}
								onChange={(event) =>
									setEditor((current) => ({
										...current,
										m2mPermissionsText: event.target.value,
									}))
								}
							/>
						</label>
						<label className="flex items-center gap-2 text-sm">
							<Checkbox
								checked={editor.isConfidential}
								onCheckedChange={(checked) =>
									setEditor((current) => ({
										...current,
										isConfidential: checked === true,
									}))
								}
							/>
							Confidential client (has secret)
						</label>
						<label className="flex items-center gap-2 text-sm">
							<Checkbox
								checked={editor.requireConsent}
								onCheckedChange={(checked) =>
									setEditor((current) => ({
										...current,
										requireConsent: checked === true,
									}))
								}
							/>
							Require consent screen
						</label>
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
							Cancel
						</Button>
						<Button type="button" disabled={submitting} onClick={() => void handleSave()}>
							{submitting ? <Loader2 className="size-4 animate-spin" /> : null}
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={secretReveal !== null} onOpenChange={() => setSecretReveal(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Client secret</DialogTitle>
						<DialogDescription>
							Copy this secret now. It will not be shown again.
						</DialogDescription>
					</DialogHeader>
					<div className="flex items-center gap-2">
						<code className="bg-muted flex-1 overflow-x-auto rounded-md px-3 py-2 text-sm">
							{secretReveal}
						</code>
						<Button
							type="button"
							variant="outline"
							size="icon"
							onClick={() => {
								if (secretReveal) {
									void navigator.clipboard.writeText(secretReveal);
								}
							}}
						>
							<Copy className="size-4" />
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			<Dialog
				open={grantsClient !== null}
				onOpenChange={(open) => {
					if (!open) {
						setGrantsClient(null);
					}
				}}
			>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>Consent grants — {grantsClient?.name}</DialogTitle>
						<DialogDescription>
							Revoke an account’s grant to force re-consent on the next authorize.
						</DialogDescription>
					</DialogHeader>
					{grantsLoading ? (
						<Skeleton className="h-20 w-full" />
					) : grants.length === 0 ? (
						<p className="text-muted-foreground text-sm">No grants yet.</p>
					) : (
						<ul className="space-y-2">
							{grants.map((grant) => (
								<li
									key={grant.id}
									className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
								>
									<div>
										<p className="font-medium">{grant.loginIdentifier}</p>
										<p className="text-muted-foreground text-xs">
											{grant.scopes.join(" ")}
										</p>
									</div>
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={submitting}
										onClick={() => void revokeGrant(grant.accountId)}
									>
										Revoke
									</Button>
								</li>
							))}
						</ul>
					)}
				</DialogContent>
			</Dialog>

			<ConfirmDialog
				open={deleteId !== null}
				onOpenChange={(open) => {
					if (!open) {
						setDeleteId(null);
					}
				}}
				title="Delete OIDC client?"
				description="This revokes refresh tokens and consent grants for the client. Access tokens expire naturally."
				confirmLabel="Delete"
				pending={submitting}
				onConfirm={() => void handleDelete()}
			/>
		</div>
	);
}
