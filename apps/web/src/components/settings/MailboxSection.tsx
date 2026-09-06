import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Inbox, Plus, Search, Trash2, User, Users } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";

import { AddMailboxDialog } from "@/components/settings/AddMailboxDialog";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccounts } from "@/hooks/use-accounts";
import { useDomains } from "@/hooks/use-domains";
import { useDeleteMailbox, useMailboxes } from "@/hooks/use-mailboxes";
import type { Mailbox } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { filterDomainsForAccount } from "@/lib/accounts/domains";
import {
	canAccessAccountsTab,
	canManageMailboxes,
} from "@/lib/accounts/permissions";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
	buildDomainNamesById,
	groupMailboxesByDomain,
	type MailboxDomainGroup,
	type MailboxTypeGroup,
} from "@/lib/sort-mailboxes";
import { cn } from "@/lib/utils";

export function MailboxSection() {
	const { t } = useTranslation("management");
	const { account } = useAuth();
	const canManage = canManageMailboxes(account);
	const canViewAccounts = canAccessAccountsTab(account);
	const mailboxesQuery = useMailboxes("manage");
	const domainsQuery = useDomains();
	const accountsQuery = useAccounts({ enabled: canViewAccounts });
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

	const accountIdByPrimaryMailboxId = useMemo(() => {
		const map = new Map<string, string>();
		for (const item of accountsQuery.data ?? []) {
			if (item.primaryMailboxId) {
				map.set(item.primaryMailboxId, item.id);
			}
		}
		return map;
	}, [accountsQuery.data]);

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
			<p className="text-muted-foreground text-sm">{t("mailboxes.noPermission")}</p>
		);
	}

	return (
		<section className="space-y-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 className="text-lg font-medium">{t("mailboxes.title")}</h2>
					<p className="text-muted-foreground text-sm">{t("mailboxes.description")}</p>
				</div>
				<Button onClick={() => setAddOpen(true)} disabled={domains.length === 0}>
					<Plus className="size-4" aria-hidden />
					{t("mailboxes.add")}
				</Button>
			</div>

			<div className="relative">
				<Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
				<Input
					placeholder={t("mailboxes.searchPlaceholder")}
					className="pl-9"
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					aria-label={t("mailboxes.searchAria")}
				/>
			</div>

			{mailboxesQuery.isLoading ? (
				<div className="space-y-2">
					{Array.from({ length: 3 }).map((_, index) => (
						<Skeleton key={index} className="h-14 w-full rounded-lg" />
					))}
				</div>
			) : mailboxesQuery.isError ? (
				<Alert tone="destructive" title={t("mailboxes.loadErrorTitle")}>
					<p>{getErrorMessage(mailboxesQuery.error)}</p>
				</Alert>
			) : filteredMailboxes.length === 0 ? (
				<Card className="gap-0 rounded-lg py-0">
					<CardContent className="flex flex-col items-center gap-2 px-4 py-10 text-center">
						<Inbox className="text-muted-foreground/60 size-6" aria-hidden />
						<p className="text-sm font-medium">
							{searchQuery
								? t("mailboxes.empty.noMatch", { query: search.trim() })
								: t("mailboxes.empty.title")}
						</p>
						<p className="text-muted-foreground max-w-sm text-sm">
							{searchQuery
								? t("mailboxes.empty.tryDifferent")
								: domains.length === 0
									? t("mailboxes.empty.addDomainFirst")
									: t("mailboxes.empty.createHint")}
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
							accountIdByPrimaryMailboxId={accountIdByPrimaryMailboxId}
							canViewAccounts={canViewAccounts}
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
	accountIdByPrimaryMailboxId,
	canViewAccounts,
}: {
	group: MailboxDomainGroup;
	showDomainHeader: boolean;
	isTypeSectionCollapsed: (domainKey: string, type: string) => boolean;
	onToggleTypeSection: (domainKey: string, type: string) => void;
	resolveAliasTargetLabel: (mailbox: Mailbox) => string | undefined;
	accountIdByPrimaryMailboxId: Map<string, string>;
	canViewAccounts: boolean;
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
					accountIdByPrimaryMailboxId={accountIdByPrimaryMailboxId}
					canViewAccounts={canViewAccounts}
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
	accountIdByPrimaryMailboxId,
	canViewAccounts,
}: {
	domainKey: string;
	typeGroup: MailboxTypeGroup;
	isCollapsed: boolean;
	onToggle: () => void;
	resolveAliasTargetLabel: (mailbox: Mailbox) => string | undefined;
	accountIdByPrimaryMailboxId: Map<string, string>;
	canViewAccounts: boolean;
}) {
	const { t } = useTranslation("management");
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
				<span className="text-foreground">
					{t(`mailboxes.typeLabels.${typeGroup.type}`, {
						defaultValue: typeGroup.type,
					})}
				</span>
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
							accountId={
								mailbox.id
									? accountIdByPrimaryMailboxId.get(mailbox.id)
									: undefined
							}
							canViewAccounts={canViewAccounts}
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
	accountId,
	canViewAccounts,
	showDomain = true,
	showType = true,
}: {
	mailbox: Mailbox;
	domainName?: string;
	aliasTargetLabel?: string;
	accountId?: string;
	canViewAccounts: boolean;
	showDomain?: boolean;
	showType?: boolean;
}) {
	const { t } = useTranslation("management");
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
	const showViewUser =
		isPrimaryMailbox && canViewAccounts && Boolean(accountId);
	const showSharedActions = mailbox.type === "shared" && Boolean(mailbox.id);
	const showActions =
		!isSystemManaged && (showViewUser || showSharedActions || canDelete);

	return (
		<li className="space-y-2 p-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0 space-y-1">
					<p className="truncate font-medium">{mailbox.address}</p>
					<div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
						{showDomain && domainName ? <span>{domainName}</span> : null}
						{showType && mailbox.type ? (
							<Badge variant="outline" className="text-xs">
								{t(`mailboxes.typeLabels.${mailbox.type}`, {
									defaultValue: mailbox.type,
								})}
							</Badge>
						) : null}
						{isSystemManaged ? (
							<Badge variant="secondary" className="text-xs">
								{t("mailboxes.badge.systemManaged")}
							</Badge>
						) : null}
						{mailbox.type === "alias" && aliasTargetLabel ? (
							<span>→ {aliasTargetLabel}</span>
						) : null}
						{mailbox.isActive === false ? (
							<Badge variant="secondary" className="text-xs">
								{t("mailboxes.badge.disabled")}
							</Badge>
						) : null}
					</div>
				</div>

				{showActions ? (
					<div className="flex shrink-0 items-center gap-2">
						{showViewUser ? (
							<Button variant="outline" size="sm" asChild>
								<Link to={`/management?tab=accounts&account=${accountId}`}>
									<User className="mr-1.5 size-3.5" />
									{t("mailboxes.viewUser")}
								</Link>
							</Button>
						) : null}
						{showSharedActions ? (
							<>
								<Button variant="outline" size="sm" asChild>
									<Link to={`/management/mailboxes/${mailbox.id}/users`}>
										<Users className="mr-1.5 size-3.5" />
										{t("mailboxes.users")}
									</Link>
								</Button>
								<Button variant="outline" size="sm" asChild>
									<Link
										to={`/management/mailboxes/${mailbox.id}/users?tab=identities`}
									>
										{t("mailboxes.identities")}
									</Link>
								</Button>
							</>
						) : null}
						{canDelete ? (
							<Button
								variant="ghost"
								size="icon"
								onClick={() => setConfirmingDelete(true)}
								disabled={isPending}
								aria-label={t("mailboxes.deleteAria", {
									address: mailbox.address,
								})}
							>
								<Trash2 className="text-destructive size-4" />
							</Button>
						) : null}
					</div>
				) : null}
			</div>

			{mutationError ? (
				<Alert tone="destructive">
					<p>{getErrorMessage(mutationError)}</p>
				</Alert>
			) : null}

			<ConfirmDialog
				open={confirmingDelete}
				onOpenChange={setConfirmingDelete}
				title={t("mailboxes.deleteConfirm.title", { address: mailbox.address })}
				description={
					<>
						<p>
							<Trans
								i18nKey="mailboxes.deleteConfirm.description"
								ns="management"
								components={{ strong: <strong /> }}
							/>
						</p>
						<p>{t("mailboxes.deleteConfirm.cannotUndo")}</p>
					</>
				}
				confirmLabel={t("mailboxes.deleteConfirm.confirm")}
				onConfirm={handleDelete}
				pending={deleteMailbox.isPending}
			/>
		</li>
	);
}
