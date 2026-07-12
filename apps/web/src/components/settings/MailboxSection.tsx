import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Inbox, Plus, Search, Trash2, Users } from "lucide-react";

import { AddMailboxDialog } from "@/components/settings/AddMailboxDialog";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDomains } from "@/hooks/use-domains";
import { useDeleteMailbox, useMailboxes } from "@/hooks/use-mailboxes";
import type { Mailbox } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { filterDomainsForAccount } from "@/lib/accounts/domains";
import { canManageMailboxes } from "@/lib/accounts/permissions";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
	buildDomainNamesById,
	groupMailboxesByDomain,
	type MailboxDomainGroup,
	type MailboxTypeGroup,
} from "@/lib/sort-mailboxes";
import { cn } from "@/lib/utils";

export function MailboxSection() {
	const { account } = useAuth();
	const canManage = canManageMailboxes(account);
	const mailboxesQuery = useMailboxes("manage");
	const domainsQuery = useDomains();
	const [search, setSearch] = useState("");
	const [addOpen, setAddOpen] = useState(false);
	const [collapsedTypeSections, setCollapsedTypeSections] = useState<
		Record<string, boolean>
	>({});

	const domains = useMemo(
		() => filterDomainsForAccount(account, domainsQuery.data ?? []),
		[account, domainsQuery.data],
	);
	const mailboxes = mailboxesQuery.data ?? [];
	const domainNamesById = useMemo(
		() => buildDomainNamesById(domains, mailboxes),
		[domains, mailboxes],
	);

	const searchQuery = search.trim().toLowerCase();
	const filteredMailboxes = useMemo(() => {
		if (!searchQuery) {
			return mailboxes;
		}
		return mailboxes.filter((mailbox) =>
			mailbox.address?.toLowerCase().includes(searchQuery),
		);
	}, [mailboxes, searchQuery]);

	const mailboxGroups = useMemo(
		() => groupMailboxesByDomain(filteredMailboxes, domainNamesById),
		[filteredMailboxes, domainNamesById],
	);
	const shouldGroupByDomain = mailboxGroups.length > 1;

	const isTypeSectionCollapsed = (domainKey: string, type: string) => {
		// While searching, always show matches.
		if (searchQuery) {
			return false;
		}
		const key = `${domainKey}:${type}`;
		if (key in collapsedTypeSections) {
			return collapsedTypeSections[key];
		}

		return type === "system";
	};

	const toggleTypeSection = (domainKey: string, type: string) => {
		if (searchQuery) {
			return;
		}
		const key = `${domainKey}:${type}`;
		setCollapsedTypeSections((current) => ({
			...current,
			[key]: !isTypeSectionCollapsed(domainKey, type),
		}));
	};

	const resolveAliasTargetLabel = (mailbox: Mailbox) =>
		mailbox.aliasTargetAddress ??
		mailboxes.find((item) => item.id === mailbox.aliasTargetId)?.address;

	if (!canManage) {
		return (
			<p className="text-muted-foreground text-sm">
				You do not have permission to create or manage mailboxes.
			</p>
		);
	}

	return (
		<section className="space-y-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 className="text-lg font-medium">Mailboxes</h2>
					<p className="text-muted-foreground text-sm">
						Create and manage email addresses on your domains.
					</p>
				</div>
				<Button onClick={() => setAddOpen(true)} disabled={domains.length === 0}>
					<Plus className="size-4" aria-hidden />
					Add mailbox
				</Button>
			</div>

			<div className="relative">
				<Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
				<Input
					placeholder="Search mailboxes by address…"
					className="pl-9"
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					aria-label="Search mailboxes"
				/>
			</div>

			{mailboxesQuery.isLoading ? (
				<div className="space-y-2">
					{Array.from({ length: 3 }).map((_, index) => (
						<Skeleton key={index} className="h-14 w-full rounded-lg" />
					))}
				</div>
			) : mailboxesQuery.isError ? (
				<Alert tone="destructive" title="Couldn't load mailboxes">
					<p>{getErrorMessage(mailboxesQuery.error)}</p>
				</Alert>
			) : filteredMailboxes.length === 0 ? (
				<Card className="gap-0 rounded-lg py-0">
					<CardContent className="flex flex-col items-center gap-2 px-4 py-10 text-center">
						<Inbox className="text-muted-foreground/60 size-6" aria-hidden />
						<p className="text-sm font-medium">
							{searchQuery ? `No mailboxes match "${search.trim()}"` : "No mailboxes yet"}
						</p>
						<p className="text-muted-foreground max-w-sm text-sm">
							{searchQuery
								? "Try a different search term."
								: domains.length === 0
									? "Add a domain first, then create mailboxes on it."
									: "Create a shared mailbox or alias to start routing mail on your domains."}
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-4">
					{mailboxGroups.map((group) => (
						<MailboxDomainCard
							key={group.domainId ?? group.domainName}
							group={group}
							showDomainHeader={shouldGroupByDomain}
							isTypeSectionCollapsed={isTypeSectionCollapsed}
							onToggleTypeSection={toggleTypeSection}
							resolveAliasTargetLabel={resolveAliasTargetLabel}
						/>
					))}
				</div>
			)}

			<AddMailboxDialog open={addOpen} onOpenChange={setAddOpen} />
		</section>
	);
}

function MailboxDomainCard({
	group,
	showDomainHeader,
	isTypeSectionCollapsed,
	onToggleTypeSection,
	resolveAliasTargetLabel,
}: {
	group: MailboxDomainGroup;
	showDomainHeader: boolean;
	isTypeSectionCollapsed: (domainKey: string, type: string) => boolean;
	onToggleTypeSection: (domainKey: string, type: string) => void;
	resolveAliasTargetLabel: (mailbox: Mailbox) => string | undefined;
}) {
	const domainKey = group.domainId ?? group.domainName;

	return (
		<Card className="gap-0 overflow-hidden rounded-md py-0">
			{showDomainHeader ? (
				<div className="bg-muted/40 text-muted-foreground border-b px-4 py-2 text-sm font-medium">
					{group.domainName}
				</div>
			) : null}

			{group.typeGroups.map((typeGroup) => (
				<MailboxTypeSection
					key={typeGroup.type}
					domainKey={domainKey}
					typeGroup={typeGroup}
					isCollapsed={isTypeSectionCollapsed(domainKey, typeGroup.type)}
					onToggle={() => onToggleTypeSection(domainKey, typeGroup.type)}
					resolveAliasTargetLabel={resolveAliasTargetLabel}
				/>
			))}
		</Card>
	);
}

function MailboxTypeSection({
	domainKey,
	typeGroup,
	isCollapsed,
	onToggle,
	resolveAliasTargetLabel,
}: {
	domainKey: string;
	typeGroup: MailboxTypeGroup;
	isCollapsed: boolean;
	onToggle: () => void;
	resolveAliasTargetLabel: (mailbox: Mailbox) => string | undefined;
}) {
	const sectionId = `${domainKey}-${typeGroup.type}-mailboxes`;

	return (
		<div className="border-b last:border-b-0">
			<button
				type="button"
				onClick={onToggle}
				aria-expanded={!isCollapsed}
				aria-controls={sectionId}
				className="bg-muted/20 text-muted-foreground hover:bg-muted/35 flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium transition-colors"
			>
				<ChevronDown
					className={cn(
						"size-4 shrink-0 transition-transform",
						isCollapsed && "-rotate-90",
					)}
				/>
				<span className="text-foreground capitalize">{typeGroup.type}</span>
				<span className="font-normal">({typeGroup.mailboxes.length})</span>
			</button>

			{!isCollapsed ? (
				<ul id={sectionId} className="divide-border divide-y">
					{typeGroup.mailboxes.map((mailbox) => (
						<MailboxRow
							key={mailbox.id}
							mailbox={mailbox}
							showType={false}
							aliasTargetLabel={resolveAliasTargetLabel(mailbox)}
						/>
					))}
				</ul>
			) : null}
		</div>
	);
}

function MailboxRow({
	mailbox,
	domainName,
	aliasTargetLabel,
	showDomain = true,
	showType = true,
}: {
	mailbox: Mailbox;
	domainName?: string;
	aliasTargetLabel?: string;
	showDomain?: boolean;
	showType?: boolean;
}) {
	const deleteMailbox = useDeleteMailbox();
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	if (!mailbox.id) {
		return null;
	}

	const handleDelete = () => {
		deleteMailbox.mutate(mailbox.id!, {
			onSettled: () => setConfirmingDelete(false),
		});
	};

	const isPending = deleteMailbox.isPending;
	const mutationError = deleteMailbox.error;
	const isSystemManaged = mailbox.isSystemManaged ?? false;
	const isPrimaryMailbox = mailbox.type === "primary";
	const canDelete = !isSystemManaged && !isPrimaryMailbox;

	return (
		<li className="space-y-2 p-4">
			<div className="flex items-center justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<p className="truncate font-medium">{mailbox.address}</p>
					<div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
						{showDomain && domainName ? <span>{domainName}</span> : null}
						{showType && mailbox.type ? (
							<Badge variant="outline" className="text-xs">
								{mailbox.type}
							</Badge>
						) : null}
						{isSystemManaged ? (
							<Badge variant="secondary" className="text-xs">
								system managed
							</Badge>
						) : null}
						{mailbox.type === "alias" && aliasTargetLabel ? (
							<span>→ {aliasTargetLabel}</span>
						) : null}
						{mailbox.isActive === false ? (
							<Badge variant="secondary" className="text-xs">
								Disabled
							</Badge>
						) : null}
					</div>
				</div>

				{isSystemManaged ? null : (
					<div className="flex shrink-0 items-center gap-2">
						{mailbox.type === "shared" && mailbox.id ? (
							<Button variant="outline" size="sm" asChild>
								<Link to={`/management/mailboxes/${mailbox.id}/users`}>
									<Users className="mr-1.5 size-3.5" />
									Users
								</Link>
							</Button>
						) : null}
						{canDelete ? (
							<Button
								variant="ghost"
								size="icon"
								onClick={() => setConfirmingDelete(true)}
								disabled={isPending}
								aria-label={`Delete ${mailbox.address}`}
							>
								<Trash2 className="text-destructive size-4" />
							</Button>
						) : null}
					</div>
				)}
			</div>

			{mutationError ? (
				<Alert tone="destructive">
					<p>{getErrorMessage(mutationError)}</p>
				</Alert>
			) : null}

			<ConfirmDialog
				open={confirmingDelete}
				onOpenChange={setConfirmingDelete}
				title={`Delete ${mailbox.address}?`}
				description={
					<>
						<p>
							This permanently removes the mailbox and{" "}
							<strong>every message stored in it</strong>.
						</p>
						<p>This cannot be undone.</p>
					</>
				}
				confirmLabel="Delete mailbox"
				onConfirm={handleDelete}
				pending={deleteMailbox.isPending}
			/>
		</li>
	);
}
