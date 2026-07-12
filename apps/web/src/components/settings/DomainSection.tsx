import { useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ChevronDown, Globe, Trash2 } from "lucide-react";

import { ReadinessBadge } from "@/components/settings/domain-validation/ReadinessBadge";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
import { canRegisterDomains } from "@/lib/accounts/permissions";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/utils";
import { DomainLocalPartPolicy } from "@/components/settings/accounts/DomainLocalPartPolicy";

export function DomainSection() {
	const { account } = useAuth();
	const canRegister = canRegisterDomains(account);
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

			{canRegister ? (
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
			) : null}

			{canRegister && createDomain.isError ? (
				<Alert tone="destructive" title="Couldn't add domain">
					<p>{getErrorMessage(createDomain.error)}</p>
				</Alert>
			) : null}

			{domainsQuery.isLoading ? (
				<div className="space-y-2">
					{Array.from({ length: 2 }).map((_, index) => (
						<Skeleton key={index} className="h-16 w-full rounded-lg" />
					))}
				</div>
			) : domainsQuery.isError ? (
				<Alert tone="destructive" title="Couldn't load domains">
					<p>{getErrorMessage(domainsQuery.error)}</p>
				</Alert>
			) : (domainsQuery.data ?? []).length === 0 ? (
				<Card className="gap-0 rounded-lg py-0">
					<CardContent className="flex flex-col items-center gap-2 px-4 py-10 text-center">
						<Globe className="text-muted-foreground/60 size-6" aria-hidden />
						<p className="text-sm font-medium">
							{canRegister
								? "No domains yet"
								: "No domains assigned to your account"}
						</p>
						<p className="text-muted-foreground max-w-sm text-sm">
							{canRegister
								? "Add the domain you want Flaremail to receive mail for. You can verify DNS afterwards."
								: "Ask an owner to assign a domain to your account."}
						</p>
					</CardContent>
				</Card>
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
	const { account } = useAuth();
	const canRegister = canRegisterDomains(account);
	const updateDomain = useUpdateDomain();
	const deleteDomain = useDeleteDomain();
	const mailboxesQuery = useMailboxes("manage");
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [catchAllOpen, setCatchAllOpen] = useState(false);

	if (!domain.id) {
		return null;
	}

	const domainMailboxes = (mailboxesQuery.data ?? []).filter(
		(mailbox) =>
			mailbox.domainId === domain.id &&
			mailbox.type !== "alias" &&
			mailbox.type !== "blackhole",
	);

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
		deleteDomain.mutate(domain.id!, {
			onSettled: () => setConfirmingDelete(false),
		});
	};

	const isPending = updateDomain.isPending || deleteDomain.isPending;
	const mutationError = updateDomain.error ?? deleteDomain.error;

	return (
		<li className="space-y-3 p-4">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<p className="font-medium">{domain.domain}</p>
					<div className="flex flex-wrap gap-1.5">
						{domain.isActive === false ? (
							<Badge variant="secondary">Disabled</Badge>
						) : null}
						<ReadinessBadge readiness={domain.readiness} />
						{domain.catchAllEnabled ? (
							<Badge variant="secondary">Catch-all</Badge>
						) : null}
					</div>
				</div>
				<div className="flex items-center gap-1">
					<Button variant="outline" size="sm" asChild>
						<Link
							to={`/management/domains/${domain.id}/validation`}
							aria-label={`View readiness for ${domain.domain}`}
						>
							<Activity className="size-3.5" />
							Readiness
						</Link>
					</Button>
					{canRegister ? (
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setConfirmingDelete(true)}
							disabled={isPending}
							aria-label={`Delete ${domain.domain}`}
						>
							<Trash2 className="text-destructive size-4" />
						</Button>
					) : null}
				</div>
			</div>

			<ConfirmDialog
				open={confirmingDelete}
				onOpenChange={setConfirmingDelete}
				title={`Delete ${domain.domain}?`}
				description={
					<>
						<p>
							This permanently removes the domain along with{" "}
							<strong>every mailbox and message</strong> on it.
						</p>
						<p>This cannot be undone.</p>
					</>
				}
				confirmLabel="Delete domain"
				onConfirm={handleDelete}
				pending={deleteDomain.isPending}
			/>

			<div className="rounded-md border">
				<button
					type="button"
					onClick={() => setCatchAllOpen((current) => !current)}
					aria-expanded={catchAllOpen}
					className="hover:bg-muted/40 flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
				>
					<div>
						<p className="text-sm font-medium">Catch-all</p>
						<p className="text-muted-foreground text-xs">
							Route unmatched addresses to a mailbox on this domain.
						</p>
					</div>
					<ChevronDown
						className={cn(
							"text-muted-foreground size-4 shrink-0 transition-transform",
							catchAllOpen && "rotate-180",
						)}
					/>
				</button>
				{catchAllOpen ? (
					<div className="space-y-3 border-t px-3 py-3">
						<div className="flex items-center gap-2 text-sm">
							<Checkbox
								id={`domain-catch-all-${domain.id}`}
								checked={domain.catchAllEnabled ?? false}
								onCheckedChange={handleToggleCatchAll}
								disabled={isPending}
							/>
							<label
								htmlFor={`domain-catch-all-${domain.id}`}
								className="cursor-pointer"
							>
								Enabled
							</label>
						</div>
						{domain.catchAllEnabled ? (
							<div className="space-y-1">
								<label
									className="text-muted-foreground text-xs"
									htmlFor={`catch-all-mailbox-${domain.id}`}
								>
									Catch-all mailbox
								</label>
								<Select
									value={domain.catchAllMailboxId ?? undefined}
									onValueChange={handleCatchAllMailbox}
									disabled={isPending || mailboxesQuery.isLoading}
								>
									<SelectTrigger
										id={`catch-all-mailbox-${domain.id}`}
										className="max-w-sm"
									>
										<SelectValue placeholder="Select mailbox…" />
									</SelectTrigger>
									<SelectContent>
										{domainMailboxes.map((mailbox) =>
											mailbox.id ? (
												<SelectItem key={mailbox.id} value={mailbox.id}>
													{mailbox.address}
												</SelectItem>
											) : null,
										)}
									</SelectContent>
								</Select>
							</div>
						) : null}
					</div>
				) : null}
			</div>

			{mutationError ? (
				<Alert tone="destructive">
					<p>{getErrorMessage(mutationError)}</p>
				</Alert>
			) : null}

			<DomainLocalPartPolicy domainId={domain.id} />
		</li>
	);
}
