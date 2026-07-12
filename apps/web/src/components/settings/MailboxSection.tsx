import { useMemo, useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LegacyCombobox } from "@/components/ui/legacy-combobox";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@/components/ui/input-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDomains } from "@/hooks/use-domains";
import {
	useCreateMailbox,
	useDeleteMailbox,
	useMailboxes,
	useUpdateMailbox,
} from "@/hooks/use-mailboxes";
import type { CreateMailboxRequest, Mailbox } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { filterDomainsForAccount } from "@/lib/accounts/domains";
import { canManageMailboxes } from "@/lib/accounts/permissions";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
	groupMailboxesByDomain,
	sortMailboxes,
	type MailboxDomainGroup,
	type MailboxTypeGroup,
} from "@/lib/sort-mailboxes";
import { cn } from "@/lib/utils";

const MAILBOX_TYPES: CreateMailboxRequest["type"][] = ["shared", "alias"];

const emptyForm = {
	localPart: "",
	domainId: "",
	type: "shared" as CreateMailboxRequest["type"],
	aliasTarget: "",
};

function sanitizeLocalPart(value: string): string {
	return value.replace(/@/g, "");
}

function isValidEmailAddress(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

type ResolvedAliasTarget =
	| { kind: "internal"; aliasTargetId: string }
	| { kind: "external"; aliasTargetAddress: string }
	| { kind: "invalid" };

function resolveAliasTarget(
	input: string,
	receivingMailboxes: Mailbox[],
): ResolvedAliasTarget {
	const trimmed = input.trim();
	if (!trimmed) {
		return { kind: "invalid" };
	}

	const normalized = trimmed.toLowerCase();
	const byId = receivingMailboxes.find((mailbox) => mailbox.id === trimmed);
	if (byId?.id) {
		return { kind: "internal", aliasTargetId: byId.id };
	}

	const byAddress = receivingMailboxes.find(
		(mailbox) => mailbox.address?.toLowerCase() === normalized,
	);
	if (byAddress?.id) {
		return { kind: "internal", aliasTargetId: byAddress.id };
	}

	if (isValidEmailAddress(trimmed)) {
		return { kind: "external", aliasTargetAddress: trimmed };
	}

	return { kind: "invalid" };
}

export function MailboxSection() {
	const { account } = useAuth();
	const canManage = canManageMailboxes(account);
	const mailboxesQuery = useMailboxes("manage");
	const domainsQuery = useDomains();
	const createMailbox = useCreateMailbox();
	const [form, setForm] = useState(emptyForm);
	const [collapsedTypeSections, setCollapsedTypeSections] = useState<
		Record<string, boolean>
	>({});

	const domains = useMemo(
		() => filterDomainsForAccount(account, domainsQuery.data ?? []),
		[account, domainsQuery.data],
	);
	const mailboxes = mailboxesQuery.data ?? [];
	const domainNamesById = useMemo(
		() =>
			new Map(
				domains.flatMap((domain) =>
					domain.id && domain.domain
						? [[domain.id, domain.domain] as const]
						: [],
				),
			),
		[domains],
	);
	const mailboxGroups = useMemo(
		() => groupMailboxesByDomain(mailboxes, domainNamesById),
		[mailboxes, domainNamesById],
	);
	const shouldGroupByDomain = mailboxGroups.length > 1;
	const receivingMailboxes = useMemo(
		() =>
			sortMailboxes(
				mailboxes.filter((mailbox) => mailbox.type !== "alias"),
				domainNamesById,
			),
		[mailboxes, domainNamesById],
	);

	const handleCreate = (event: React.FormEvent) => {
		event.preventDefault();

		const selectedDomain = domains.find((domain) => domain.id === form.domainId);
		if (!selectedDomain?.domain) {
			return;
		}

		const localPart = form.localPart.trim();
		const body: CreateMailboxRequest = {
			address: `${localPart}@${selectedDomain.domain}`,
			domainId: form.domainId,
			type: form.type,
		};

		if (form.type === "alias") {
			const resolvedAliasTarget = resolveAliasTarget(
				form.aliasTarget,
				receivingMailboxes,
			);
			if (resolvedAliasTarget.kind === "internal") {
				body.aliasTargetId = resolvedAliasTarget.aliasTargetId;
			} else if (resolvedAliasTarget.kind === "external") {
				body.aliasTargetAddress = resolvedAliasTarget.aliasTargetAddress;
			} else {
				return;
			}
		}

		createMailbox.mutate(body, {
			onSuccess: () => setForm(emptyForm),
		});
	};

	const resolvedAliasTarget = useMemo(
		() =>
			form.type === "alias"
				? resolveAliasTarget(form.aliasTarget, receivingMailboxes)
				: null,
		[form.type, form.aliasTarget, receivingMailboxes],
	);

	const canSubmit =
		form.localPart.trim() &&
		form.domainId &&
		(form.type !== "alias" || resolvedAliasTarget?.kind !== "invalid");

	const isTypeSectionCollapsed = (domainKey: string, type: string) => {
		const key = `${domainKey}:${type}`;
		if (key in collapsedTypeSections) {
			return collapsedTypeSections[key];
		}

		return type === "system";
	};

	const toggleTypeSection = (domainKey: string, type: string) => {
		const key = `${domainKey}:${type}`;
		setCollapsedTypeSections((current) => ({
			...current,
			[key]: !isTypeSectionCollapsed(domainKey, type),
		}));
	};

	const resolveAliasTargetLabel = (mailbox: Mailbox) =>
		mailbox.aliasTargetAddress ??
		mailboxes.find((item) => item.id === mailbox.aliasTargetId)?.address;

	const aliasTargetOptions = receivingMailboxes.flatMap((mailbox) =>
		mailbox.id && mailbox.address
			? [{ value: mailbox.id, label: mailbox.address }]
			: [],
	);

	return (
		<section className="space-y-4">
			<div>
				<h2 className="text-lg font-medium">Mailboxes</h2>
				<p className="text-muted-foreground text-sm">
					Create and manage email addresses on your domains.
				</p>
			</div>

			<Card className="gap-0 rounded-md py-0">
				{canManage ? (
				<CardContent className="p-0">
					<form onSubmit={handleCreate} className="space-y-3 p-4">
				<div className="grid gap-3 sm:grid-cols-2">
					<div className="space-y-1 sm:col-span-2">
						<label className="text-sm font-medium" htmlFor="mailbox-local-part">
							Address
						</label>
						<InputGroup>
							<InputGroupInput
								id="mailbox-local-part"
								placeholder="patrick"
								value={form.localPart}
								onChange={(event) =>
									setForm((current) => ({
										...current,
										localPart: sanitizeLocalPart(event.target.value),
									}))
								}
								disabled={createMailbox.isPending || domains.length === 0}
								autoComplete="off"
								spellCheck={false}
							/>
							<InputGroupAddon align="inline-end">
								<InputGroupText>@</InputGroupText>
								<Select
									value={form.domainId || undefined}
									onValueChange={(domainId) =>
										setForm((current) => ({ ...current, domainId }))
									}
									disabled={createMailbox.isPending || domains.length === 0}
								>
									<SelectTrigger
										id="mailbox-domain"
										aria-label="Domain"
										className="h-8 max-w-40 gap-1 border-0 bg-transparent px-1 shadow-none focus:ring-0"
									>
										<SelectValue placeholder="domain…" />
									</SelectTrigger>
									<SelectContent>
										{domains.map((domain) =>
											domain.id ? (
												<SelectItem key={domain.id} value={domain.id}>
													{domain.domain}
												</SelectItem>
											) : null,
										)}
									</SelectContent>
								</Select>
							</InputGroupAddon>
						</InputGroup>
					</div>

					<div className="space-y-1">
						<label className="text-sm font-medium" htmlFor="mailbox-type">
							Type
						</label>
						<Select
							value={form.type}
							onValueChange={(type) =>
								setForm((current) => ({
									...current,
									type: type as CreateMailboxRequest["type"],
									aliasTarget: "",
								}))
							}
							disabled={createMailbox.isPending}
						>
							<SelectTrigger id="mailbox-type">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{MAILBOX_TYPES.map((type) => (
									<SelectItem key={type} value={type}>
										{type}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{form.type === "alias" ? (
						<div className="space-y-1 sm:col-span-2">
							<label className="text-sm font-medium" htmlFor="alias-target">
								Alias target
							</label>
							<LegacyCombobox
								id="alias-target"
								value={form.aliasTarget}
								onValueChange={(aliasTarget) =>
									setForm((current) => ({ ...current, aliasTarget }))
								}
								options={aliasTargetOptions}
								allowCustom
								placeholder="Select or enter target address…"
								searchPlaceholder="Search mailboxes or enter email…"
								emptyText="No mailboxes found."
								disabled={createMailbox.isPending}
							/>
							{resolvedAliasTarget?.kind === "external" ? (
								<p className="text-muted-foreground text-xs">
									Mail to this alias is forwarded externally and not stored.
								</p>
							) : null}
						</div>
					) : null}
				</div>

				<Button
					type="submit"
					disabled={createMailbox.isPending || !canSubmit || domains.length === 0}
				>
					Add mailbox
				</Button>

				{domains.length === 0 ? (
					<p className="text-muted-foreground text-sm">Add a domain first.</p>
				) : null}
					</form>
				</CardContent>
				) : (
					<CardContent className="p-4">
						<p className="text-muted-foreground text-sm">
							You do not have permission to create or manage mailboxes.
						</p>
					</CardContent>
				)}
			</Card>

			{createMailbox.isError ? (
				<p className="text-destructive text-sm">{getErrorMessage(createMailbox.error)}</p>
			) : null}

			{mailboxesQuery.isLoading ? (
				<div className="space-y-2">
					{Array.from({ length: 3 }).map((_, index) => (
						<Skeleton key={index} className="h-14 w-full" />
					))}
				</div>
			) : mailboxesQuery.isError ? (
				<p className="text-destructive text-sm">{getErrorMessage(mailboxesQuery.error)}</p>
			) : mailboxes.length === 0 ? (
				<p className="text-muted-foreground text-sm">No mailboxes yet. Add one above.</p>
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
	const updateMailbox = useUpdateMailbox();
	const deleteMailbox = useDeleteMailbox();

	if (!mailbox.id) {
		return null;
	}

	const handleToggleActive = () => {
		updateMailbox.mutate({
			id: mailbox.id!,
			body: { isActive: !mailbox.isActive },
		});
	};

	const handleDelete = () => {
		const confirmed = window.confirm(
			`Delete mailbox "${mailbox.address}"? This permanently removes all messages in this mailbox.`,
		);
		if (!confirmed) {
			return;
		}
		deleteMailbox.mutate(mailbox.id!);
	};

	const isPending = updateMailbox.isPending || deleteMailbox.isPending;
	const mutationError = updateMailbox.error ?? deleteMailbox.error;
	const isSystemManaged = mailbox.isSystemManaged ?? false;

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
						<Badge variant={mailbox.isActive ? "default" : "secondary"}>
							{mailbox.isActive ? "Active" : "Inactive"}
						</Badge>
					</div>
				</div>

				{isSystemManaged ? null : (
					<div className="flex shrink-0 items-center gap-2">
						<label className="flex items-center gap-1.5 text-sm">
							<input
								type="checkbox"
								checked={mailbox.isActive ?? false}
								onChange={handleToggleActive}
								disabled={isPending}
								className="size-4 rounded border"
							/>
							<span className="sr-only sm:not-sr-only">Active</span>
						</label>
						<Button
							variant="ghost"
							size="icon"
							onClick={handleDelete}
							disabled={isPending}
							aria-label={`Delete ${mailbox.address}`}
						>
							<Trash2 className="text-destructive size-4" />
						</Button>
					</div>
				)}
			</div>

			{mutationError ? (
				<p className="text-destructive text-sm">{getErrorMessage(mutationError)}</p>
			) : null}
		</li>
	);
}
