import { useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Trash2 } from "lucide-react";

import { ReadinessBadge } from "@/components/settings/domain-validation/ReadinessBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
	useCreateDomain,
	useDeleteDomain,
	useDomains,
	useUpdateDomain,
} from "@/hooks/use-domains";
import { useMailboxes } from "@/hooks/use-mailboxes";
import type { Domain } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

const selectClassName =
	"border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export function DomainSection() {
	const domainsQuery = useDomains();
	const createDomain = useCreateDomain();
	const [newDomain, setNewDomain] = useState("");

	const handleCreate = (event: React.FormEvent) => {
		event.preventDefault();
		const domain = newDomain.trim();
		if (!domain) {
			return;
		}

		createDomain.mutate(
			{ domain },
			{
				onSuccess: () => setNewDomain(""),
			},
		);
	};

	return (
		<section className="space-y-4">
			<div>
				<h2 className="text-lg font-medium">Domains</h2>
				<p className="text-muted-foreground text-sm">
					Manage the domains Flaremail receives mail for.
				</p>
			</div>

			<form onSubmit={handleCreate} className="flex gap-2">
				<Input
					placeholder="example.com"
					value={newDomain}
					onChange={(event) => setNewDomain(event.target.value)}
					disabled={createDomain.isPending}
				/>
				<Button type="submit" disabled={createDomain.isPending || !newDomain.trim()}>
					Add domain
				</Button>
			</form>

			{createDomain.isError ? (
				<p className="text-destructive text-sm">{getErrorMessage(createDomain.error)}</p>
			) : null}

			{domainsQuery.isLoading ? (
				<div className="space-y-2">
					{Array.from({ length: 2 }).map((_, index) => (
						<Skeleton key={index} className="h-16 w-full" />
					))}
				</div>
			) : domainsQuery.isError ? (
				<p className="text-destructive text-sm">{getErrorMessage(domainsQuery.error)}</p>
			) : (domainsQuery.data ?? []).length === 0 ? (
				<p className="text-muted-foreground text-sm">No domains yet. Add one above.</p>
			) : (
				<Card className="gap-0 rounded-md py-0">
					<CardContent className="p-0">
						<ul className="divide-border divide-y">
							{(domainsQuery.data ?? []).map((domain) => (
								<DomainRow key={domain.id} domain={domain} />
							))}
						</ul>
					</CardContent>
				</Card>
			)}
		</section>
	);
}

function DomainRow({ domain }: { domain: Domain }) {
	const updateDomain = useUpdateDomain();
	const deleteDomain = useDeleteDomain();
	const mailboxesQuery = useMailboxes();

	if (!domain.id) {
		return null;
	}

	const domainMailboxes = (mailboxesQuery.data ?? []).filter(
		(mailbox) =>
			mailbox.domainId === domain.id &&
			mailbox.type !== "alias" &&
			mailbox.type !== "blackhole",
	);

	const handleToggleActive = () => {
		updateDomain.mutate({
			id: domain.id!,
			body: { isActive: !domain.isActive },
		});
	};

	const handleToggleCatchAll = () => {
		updateDomain.mutate({
			id: domain.id!,
			body: { catchAllEnabled: !domain.catchAllEnabled },
		});
	};

	const handleCatchAllMailbox = (mailboxId: string) => {
		updateDomain.mutate({
			id: domain.id!,
			body: {
				catchAllMailboxId: mailboxId || null,
			},
		});
	};

	const handleDelete = () => {
		const confirmed = window.confirm(
			`Delete domain "${domain.domain}"? This permanently removes all mailboxes and messages on this domain.`,
		);
		if (!confirmed) {
			return;
		}
		deleteDomain.mutate(domain.id!);
	};

	const isPending = updateDomain.isPending || deleteDomain.isPending;
	const mutationError = updateDomain.error ?? deleteDomain.error;

	return (
		<li className="space-y-3 p-4">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<p className="font-medium">{domain.domain}</p>
					<div className="flex flex-wrap gap-1.5">
						<StatusBadge active={domain.isActive ?? false} />
						<ReadinessBadge readiness={domain.readiness} />
						{domain.catchAllEnabled ? (
							<Badge variant="secondary">Catch-all</Badge>
						) : null}
					</div>
				</div>
				<div className="flex items-center gap-1">
					<Button variant="ghost" size="icon" asChild>
						<Link
							to={`/settings/domains/${domain.id}/validation`}
							aria-label={`View validation for ${domain.domain}`}
							title="View domain validation"
						>
							<Activity className="size-4" />
						</Link>
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={handleDelete}
						disabled={isPending}
						aria-label={`Delete ${domain.domain}`}
					>
						<Trash2 className="text-destructive size-4" />
					</Button>
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-4 text-sm">
				<label className="flex items-center gap-2">
					<input
						type="checkbox"
						checked={domain.isActive ?? false}
						onChange={handleToggleActive}
						disabled={isPending}
						className="size-4 rounded border"
					/>
					Active
				</label>
				<label className="flex items-center gap-2">
					<input
						type="checkbox"
						checked={domain.catchAllEnabled ?? false}
						onChange={handleToggleCatchAll}
						disabled={isPending}
						className="size-4 rounded border"
					/>
					Catch-all enabled
				</label>
			</div>

			{domain.catchAllEnabled ? (
				<div className="space-y-1">
					<label className="text-muted-foreground text-xs">Catch-all mailbox</label>
					<select
						className={cn(selectClassName, "max-w-sm")}
						value={domain.catchAllMailboxId ?? ""}
						onChange={(event) => handleCatchAllMailbox(event.target.value)}
						disabled={isPending || mailboxesQuery.isLoading}
					>
						<option value="">Select mailbox…</option>
						{domainMailboxes.map((mailbox) => (
							<option key={mailbox.id} value={mailbox.id}>
								{mailbox.address}
							</option>
						))}
					</select>
				</div>
			) : null}

			{mutationError ? (
				<p className="text-destructive text-sm">{getErrorMessage(mutationError)}</p>
			) : null}
		</li>
	);
}

function StatusBadge({ active }: { active: boolean }) {
	return (
		<Badge variant={active ? "default" : "secondary"}>
			{active ? "Active" : "Inactive"}
		</Badge>
	);
}
