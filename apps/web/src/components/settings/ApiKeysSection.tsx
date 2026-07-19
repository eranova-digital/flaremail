import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Copy, KeyRound, Loader2, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import type { ApiKeySummary } from "@/lib/auth/types";
import { getErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

type ApiKeysSectionProps = {
	title: string;
	description: string;
	emptyState: string;
	createLabel: string;
	dialogTitle: string;
	dialogDescription: string;
	namePlaceholder: string;
	secretTitle: string;
	loadKeys: () => Promise<{ items: ApiKeySummary[]; availableScopes: string[] }>;
	createKey: (input: {
		name: string;
		scopes: string[];
	}) => Promise<{ secret: string; prefix: string; scopes: string[] }>;
	revokeKey: (keyId: string) => Promise<{ ok: true }>;
};

function formatDateTime(value: string | null, neverUsed: string): string {
	if (!value) {
		return neverUsed;
	}
	return new Date(value).toLocaleString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

function formatScope(scope: string): string {
	const [resource, action] = scope.split(":");
	return `${resource.replace(/_/g, " ")}: ${action?.replace(/_/g, " ") ?? ""}`;
}

function ScopeGroup({
	group,
	scopes,
	selectedScopes,
	search,
	onToggle,
	disabled,
}: {
	group: string;
	scopes: string[];
	selectedScopes: string[];
	search: string;
	onToggle: (scope: string, checked: boolean) => void;
	disabled: boolean;
}) {
	const { t } = useTranslation("settings");
	const [open, setOpen] = useState(false);
	const matchesSearch = search.trim().length > 0;
	const selectedCount = scopes.filter((scope) => selectedScopes.includes(scope)).length;
	const expanded = matchesSearch || open || selectedCount > 0;

	return (
		<div className="rounded-md border">
			<button
				type="button"
				onClick={() => setOpen((current) => !current)}
				className="hover:bg-muted/40 flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
			>
				<div>
					<p className="text-sm font-medium capitalize">
						{group.replace(/_/g, " ")}
					</p>
					<p className="text-muted-foreground text-xs">
						{selectedCount > 0
							? t("apiKeys.selectedCount", { count: selectedCount })
							: t("apiKeys.availableScopes", { count: scopes.length })}
					</p>
				</div>
				<ChevronDown
					className={cn(
						"text-muted-foreground size-4 shrink-0 transition-transform",
						expanded && "rotate-180",
					)}
				/>
			</button>
			{expanded ? (
				<div className="grid gap-2 border-t p-3 sm:grid-cols-2">
					{scopes.map((scope) => (
						<label
							key={scope}
							className="flex items-start gap-2 rounded-md border p-2 text-sm"
						>
							<Checkbox
								checked={selectedScopes.includes(scope)}
								onCheckedChange={(checked) => onToggle(scope, checked === true)}
								disabled={disabled}
								aria-label={scope}
							/>
							<span>{formatScope(scope)}</span>
						</label>
					))}
				</div>
			) : null}
		</div>
	);
}

function CreateApiKeyDialog({
	open,
	onOpenChange,
	title,
	description,
	namePlaceholder,
	submitLabel,
	availableScopes,
	onCreate,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: string;
	namePlaceholder: string;
	submitLabel: string;
	availableScopes: string[];
	onCreate: (input: { name: string; scopes: string[] }) => Promise<void>;
}) {
	const { t } = useTranslation("settings");
	const [name, setName] = useState("");
	const [search, setSearch] = useState("");
	const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!open) {
			setName("");
			setSearch("");
			setSelectedScopes([]);
			setSubmitting(false);
			setError(null);
		}
	}, [open]);

	const groupedScopes = useMemo(() => {
		const scopes = availableScopes ?? [];
		const query = search.trim().toLowerCase();
		const groups = new Map<string, string[]>();
		for (const scope of scopes) {
			const label = formatScope(scope).toLowerCase();
			if (query && !scope.toLowerCase().includes(query) && !label.includes(query)) {
				continue;
			}
			const [resource] = scope.split(":");
			const bucket = groups.get(resource) ?? [];
			bucket.push(scope);
			groups.set(resource, bucket);
		}
		return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
	}, [availableScopes, search]);

	const toggleScope = (scope: string, checked: boolean) => {
		setSelectedScopes((current) =>
			checked
				? [...new Set([...current, scope])].sort()
				: current.filter((value) => value !== scope),
		);
	};

	const handleCreate = async () => {
		setSubmitting(true);
		setError(null);
		try {
			await onCreate({ name, scopes: selectedScopes });
			onOpenChange(false);
		} catch (createError) {
			setError(getErrorMessage(createError));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
			<DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>

				<div className="grid min-h-0 flex-1 gap-4 overflow-hidden">
					{error ? <Alert tone="destructive">{error}</Alert> : null}

					<div className="space-y-2">
						<label htmlFor="api-key-name" className="text-sm font-medium">
							{t("apiKeys.nameLabel")}
						</label>
						<Input
							id="api-key-name"
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder={namePlaceholder}
							disabled={submitting}
						/>
					</div>

					<div className="flex min-h-0 flex-1 flex-col space-y-3 overflow-hidden">
						<div className="space-y-1">
							<p className="text-sm font-medium">{t("apiKeys.scopesLabel")}</p>
							<p className="text-muted-foreground text-xs">
								{t("apiKeys.scopesHelp")}
							</p>
						</div>
						<div className="relative">
							<Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
							<Input
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								placeholder={t("apiKeys.searchScopes")}
								className="pl-9"
								disabled={submitting}
							/>
						</div>
						<div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
							{groupedScopes.length === 0 ? (
								<p className="text-muted-foreground text-sm">
									{t("apiKeys.noScopesMatch")}
								</p>
							) : (
								groupedScopes.map(([group, scopes]) => (
									<ScopeGroup
										key={group}
										group={group}
										scopes={scopes}
										selectedScopes={selectedScopes}
										search={search}
										onToggle={toggleScope}
										disabled={submitting}
									/>
								))
							)}
						</div>
					</div>
				</div>

				<DialogFooter>
					<Button
						type="button"
						onClick={handleCreate}
						disabled={submitting || selectedScopes.length === 0}
					>
						{submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
						{submitLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function ApiKeysSection({
	title,
	description,
	emptyState,
	createLabel,
	dialogTitle,
	dialogDescription,
	namePlaceholder,
	secretTitle,
	loadKeys,
	createKey,
	revokeKey,
}: ApiKeysSectionProps) {
	const { t } = useTranslation("settings");
	const { t: tc } = useTranslation("common");
	const neverUsed = t("apiKeys.neverUsed");
	const [items, setItems] = useState<ApiKeySummary[]>([]);
	const [availableScopes, setAvailableScopes] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [successSecret, setSuccessSecret] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [createOpen, setCreateOpen] = useState(false);
	const [revokingId, setRevokingId] = useState<string | null>(null);
	const [pendingRevoke, setPendingRevoke] = useState<ApiKeySummary | null>(null);

	const refreshKeys = useCallback(async () => {
		setError(null);
		try {
			const result = await loadKeys();
			setItems(result.items);
			setAvailableScopes(result.availableScopes ?? []);
		} catch (loadError) {
			setError(getErrorMessage(loadError));
		} finally {
			setLoading(false);
		}
	}, [loadKeys]);

	useEffect(() => {
		void refreshKeys();
	}, [refreshKeys]);

	const handleCreate = async (input: { name: string; scopes: string[] }) => {
		setError(null);
		setSuccessSecret(null);
		setCopied(false);
		const result = await createKey(input);
		setSuccessSecret(result.secret);
		await refreshKeys();
	};

	const handleCopySecret = async () => {
		if (!successSecret) {
			return;
		}
		try {
			await navigator.clipboard.writeText(successSecret);
			setCopied(true);
		} catch {
			setCopied(false);
		}
	};

	const handleRevoke = async () => {
		if (!pendingRevoke) {
			return;
		}
		setRevokingId(pendingRevoke.id);
		setError(null);
		try {
			await revokeKey(pendingRevoke.id);
			setPendingRevoke(null);
			setItems((current) => current.filter((item) => item.id !== pendingRevoke.id));
		} catch (revokeError) {
			setError(getErrorMessage(revokeError));
		} finally {
			setRevokingId(null);
		}
	};

	return (
		<>
			<Card className="rounded-xl shadow-sm">
				<CardHeader className="pb-4">
					<CardTitle className="flex items-center gap-2 text-base">
						<KeyRound className="text-muted-foreground size-4" aria-hidden />
						{title}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-muted-foreground text-sm">{description}</p>

					{error ? <Alert tone="destructive">{error}</Alert> : null}
					{successSecret ? (
						<Alert tone="success" title={secretTitle}>
							<div className="space-y-3">
								<p>{t("apiKeys.secretBody")}</p>
								<code className="bg-background/70 block rounded-md px-3 py-2 font-mono text-xs break-all">
									{successSecret}
								</code>
								<Button type="button" variant="outline" size="sm" onClick={handleCopySecret}>
									{copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
									{copied ? tc("copied") : t("apiKeys.copySecret")}
								</Button>
							</div>
						</Alert>
					) : null}

					<div className="flex justify-end">
						<Button type="button" onClick={() => setCreateOpen(true)} disabled={loading}>
							{createLabel}
						</Button>
					</div>

					{loading ? (
						<div className="space-y-2">
							{Array.from({ length: 2 }).map((_, index) => (
								<Skeleton key={index} className="h-20 w-full rounded-lg" />
							))}
						</div>
					) : items.length === 0 ? (
						<p className="text-muted-foreground text-sm">{emptyState}</p>
					) : (
						<Card className="gap-0 rounded-lg py-0">
							<CardContent className="p-0">
								<ul className="divide-border divide-y">
									{items.map((item) => (
										<li
											key={item.id}
											className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 text-sm"
										>
											<div className="min-w-0 space-y-1">
												<div className="flex flex-wrap items-center gap-2">
													<p className="font-medium">{item.name}</p>
													<Badge variant="secondary">{item.prefix}</Badge>
												</div>
												<p className="text-muted-foreground text-xs">
													{t("apiKeys.createdLastUsed", {
														createdAt: formatDateTime(item.createdAt, neverUsed),
														lastUsedAt: formatDateTime(item.lastUsedAt, neverUsed),
													})}
												</p>
												<div className="flex flex-wrap gap-1">
													{item.scopes.map((scope) => (
														<Badge key={scope} variant="outline">
															{scope}
														</Badge>
													))}
												</div>
											</div>
											<Button
												variant="outline"
												size="sm"
												onClick={() => setPendingRevoke(item)}
												disabled={Boolean(revokingId)}
												className="shrink-0"
											>
												{t("apiKeys.revoke")}
											</Button>
										</li>
									))}
								</ul>
							</CardContent>
						</Card>
					)}
				</CardContent>
			</Card>

			<CreateApiKeyDialog
				open={createOpen}
				onOpenChange={setCreateOpen}
				title={dialogTitle}
				description={dialogDescription}
				namePlaceholder={namePlaceholder}
				submitLabel={createLabel}
				availableScopes={availableScopes}
				onCreate={handleCreate}
			/>

			<ConfirmDialog
				open={pendingRevoke !== null}
				onOpenChange={(open) => !open && !revokingId && setPendingRevoke(null)}
				title={t("apiKeys.revokeConfirmTitle")}
				description={
					<p>
						{pendingRevoke
							? t("apiKeys.revokeConfirmBody", { name: pendingRevoke.name })
							: t("apiKeys.revokeConfirmBodyFallback")}
					</p>
				}
				confirmLabel={t("apiKeys.revokeConfirmLabel")}
				pending={Boolean(revokingId)}
				onConfirm={handleRevoke}
			/>
		</>
	);
}
