import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ProfileFieldsGrid } from "@/components/settings/ProfileFieldsGrid";
import { ProfileFieldLockToggle } from "@/components/settings/accounts/ProfileFieldLockToggle";
import { useDomains } from "@/hooks/use-domains";
import { useMailboxes } from "@/hooks/use-mailboxes";
import {
	useInviteAccount,
	useLocalPartPolicy,
	useSuggestInviteLocalPart,
} from "@/hooks/use-accounts";
import type { AccountRole } from "@/lib/accounts/api";
import {
	filterDomainsForAccount,
	soleAccessibleDomainId,
} from "@/lib/accounts/domains";
import {
	applyLocalPartPattern,
	getProfileFieldsUsedByPattern,
} from "@flaremail/local-part-policy";
import {
	canLockProfileFields,
	inviteableRoles,
} from "@/lib/accounts/permissions";
import { ROLE_META } from "@/lib/accounts/roles";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

type ProfileFormState = {
	firstName: string;
	lastName: string;
	recoveryAddress: string;
	phone: string;
	addressCountry: string;
	addressState: string;
	addressCity: string;
	addressLine1: string;
	addressLine2: string;
};

const emptyProfile = (): ProfileFormState => ({
	firstName: "",
	lastName: "",
	recoveryAddress: "",
	phone: "",
	addressCountry: "",
	addressState: "",
	addressCity: "",
	addressLine1: "",
	addressLine2: "",
});

function CollapsibleSection({
	title,
	description,
	defaultOpen = false,
	children,
}: {
	title: string;
	description?: string;
	defaultOpen?: boolean;
	children: React.ReactNode;
}) {
	const [open, setOpen] = useState(defaultOpen);

	return (
		<div className="border-border rounded-md border">
			<button
				type="button"
				onClick={() => setOpen((current) => !current)}
				className="hover:bg-muted/40 flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
			>
				<div>
					<p className="text-sm font-medium">{title}</p>
					{description ? (
						<p className="text-muted-foreground text-xs">{description}</p>
					) : null}
				</div>
				<ChevronDown
					className={cn(
						"text-muted-foreground size-4 shrink-0 transition-transform",
						open && "rotate-180",
					)}
				/>
			</button>
			{open ? <div className="space-y-3 border-t px-4 py-4">{children}</div> : null}
		</div>
	);
}

type InviteAccountDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function InviteAccountDialog({
	open,
	onOpenChange,
}: InviteAccountDialogProps) {
	const { t } = useTranslation("management");
	const { t: tc } = useTranslation("common");
	const { account } = useAuth();
	const domainsQuery = useDomains();
	const mailboxesQuery = useMailboxes("manage");
	const inviteMutation = useInviteAccount();
	const suggestMutation = useSuggestInviteLocalPart();
	const roles = inviteableRoles(account);

	const [domainId, setDomainId] = useState("");
	const [role, setRole] = useState<AccountRole>("user");
	const [localPart, setLocalPart] = useState("");
	const [localPartOverridden, setLocalPartOverridden] = useState(false);
	const [profile, setProfile] = useState<ProfileFormState>(emptyProfile);
	const [lockedFields, setLockedFields] = useState<Set<string>>(new Set());
	const [assignedDomainIds, setAssignedDomainIds] = useState<string[]>([]);
	const [sharedMailboxIds, setSharedMailboxIds] = useState<string[]>([]);
	const [allSharedMailboxes, setAllSharedMailboxes] = useState(false);
	const [sendInviteEmail, setSendInviteEmail] = useState(false);
	const [inviteCode, setInviteCode] = useState<string | null>(null);
	const [codeCopied, setCodeCopied] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const policyQuery = useLocalPartPolicy(domainId || null);
	const canLock = canLockProfileFields(account);
	const inviterIsManager = account?.role === "manager";
	const policyPattern = policyQuery.data?.pattern ?? null;
	const policyHasPattern = !!policyPattern;
	const policyEnforced =
		inviterIsManager &&
		!!policyQuery.data?.enforced &&
		!!policyPattern;

	const availableDomains = useMemo(
		() => filterDomainsForAccount(account, domainsQuery.data ?? []),
		[account, domainsQuery.data],
	);

	useEffect(() => {
		if (!open) {
			return;
		}
		const soleDomainId = soleAccessibleDomainId(availableDomains);
		if (!soleDomainId || domainId) {
			return;
		}
		setDomainId(soleDomainId);
	}, [availableDomains, domainId, open]);

	const selectedDomain = availableDomains.find((domain) => domain.id === domainId);
	const policyRequiredFields = useMemo(
		() =>
			policyHasPattern && policyPattern
				? getProfileFieldsUsedByPattern(policyPattern)
				: [],
		[policyHasPattern, policyPattern],
	);

	const sharedMailboxes = useMemo(() => {
		const domainFilter =
			role === "manager" && assignedDomainIds.length > 0
				? new Set(assignedDomainIds)
				: domainId
					? new Set([domainId])
					: new Set<string>();
		return (mailboxesQuery.data ?? []).filter(
			(mailbox) =>
				mailbox.type === "shared" &&
				mailbox.id &&
				mailbox.domainId &&
				domainFilter.has(mailbox.domainId),
		);
	}, [assignedDomainIds, domainId, mailboxesQuery.data, role]);

	useEffect(() => {
		if (!domainId) {
			return;
		}
		if (role === "admin" && assignedDomainIds.length === 0) {
			setAssignedDomainIds([domainId]);
		}
		if (role === "manager" && assignedDomainIds.length === 0) {
			setAssignedDomainIds([domainId]);
		}
	}, [assignedDomainIds.length, domainId, role]);

	useEffect(() => {
		setLocalPartOverridden(false);
		setLocalPart("");
	}, [domainId]);

	useEffect(() => {
		if (!policyHasPattern || !policyPattern) {
			return;
		}
		if (!policyEnforced && localPartOverridden) {
			return;
		}
		const suggested = applyLocalPartPattern(policyPattern, profile);
		if (suggested) {
			setLocalPart(suggested);
		}
	}, [
		localPartOverridden,
		policyEnforced,
		policyHasPattern,
		policyPattern,
		profile.firstName,
		profile.lastName,
	]);

	useEffect(() => {
		if (policyHasPattern || !domainId || !profile.firstName.trim()) {
			return;
		}
		const timer = window.setTimeout(() => {
			suggestMutation.mutate(
				{
					domainId,
					firstName: profile.firstName,
					lastName: profile.lastName,
				},
				{
					onSuccess: (suggested) => {
						if (suggested) {
							setLocalPart(suggested);
						}
					},
				},
			);
		}, 300);
		return () => window.clearTimeout(timer);
	}, [
		domainId,
		policyHasPattern,
		profile.firstName,
		profile.lastName,
		suggestMutation,
	]);

	const resetForm = () => {
		setDomainId("");
		setRole("user");
		setLocalPart("");
		setLocalPartOverridden(false);
		setProfile(emptyProfile());
		setLockedFields(new Set());
		setAssignedDomainIds([]);
		setSharedMailboxIds([]);
		setAllSharedMailboxes(false);
		setSendInviteEmail(false);
		setInviteCode(null);
		setCodeCopied(false);
		setError(null);
	};

	const handleOpenChange = (next: boolean) => {
		onOpenChange(next);
		if (!next) {
			resetForm();
		}
	};

	const toggleLock = (field: string) => {
		if (
			policyEnforced &&
			policyRequiredFields.includes(field as "firstName" | "lastName")
		) {
			return;
		}
		setLockedFields((current) => {
			const next = new Set(current);
			if (next.has(field)) {
				next.delete(field);
			} else {
				next.add(field);
			}
			return next;
		});
	};

	const toggleAssignedDomain = (id: string) => {
		setAssignedDomainIds((current) =>
			current.includes(id)
				? current.filter((item) => item !== id)
				: [...current, id],
		);
	};

	const toggleSharedMailbox = (id: string) => {
		setSharedMailboxIds((current) =>
			current.includes(id)
				? current.filter((item) => item !== id)
				: [...current, id],
		);
	};

	const requiredProfileComplete = policyRequiredFields.every((field) => {
		const value = profile[field as keyof ProfileFormState];
		return typeof value === "string" && value.trim().length > 0;
	});

	const missingRequirement = !domainId
		? t("accounts.inviteDialog.req.selectDomain")
		: !localPart.trim()
			? t("accounts.inviteDialog.req.enterMailbox")
			: policyEnforced && !requiredProfileComplete
				? t("accounts.inviteDialog.req.fillPolicyFields")
				: (role === "admin" || role === "manager") &&
					  assignedDomainIds.length === 0
					? t("accounts.inviteDialog.req.assignDomain")
					: null;

	const canSubmit = !missingRequirement;

	const handleCopyCode = async () => {
		if (!inviteCode) {
			return;
		}
		try {
			await navigator.clipboard.writeText(inviteCode);
			setCodeCopied(true);
		} catch {
			setCodeCopied(false);
		}
	};

	const handleInvite = () => {
		setError(null);
		setInviteCode(null);
		setCodeCopied(false);
		inviteMutation.mutate(
			{
				domainId,
				localPart,
				role,
				firstName: profile.firstName,
				lastName: profile.lastName,
				recoveryAddress: profile.recoveryAddress || undefined,
				phone: profile.phone || undefined,
				addressCountry: profile.addressCountry || undefined,
				addressState: profile.addressState || undefined,
				addressCity: profile.addressCity || undefined,
				addressLine1: profile.addressLine1 || undefined,
				addressLine2: profile.addressLine2 || undefined,
				lockedFields: canLock ? [...lockedFields] : undefined,
				sendInviteEmail,
				assignedDomainIds:
					role === "admin" || role === "manager" ? assignedDomainIds : undefined,
				sharedMailboxIds:
					role === "manager" && !allSharedMailboxes
						? sharedMailboxIds
						: undefined,
				allSharedMailboxes: role === "manager" ? allSharedMailboxes : undefined,
			},
			{
				onSuccess: (data) => {
					setInviteCode(data.inviteCode);
				},
				onError: (err) => setError(getErrorMessage(err)),
			},
		);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-xl">
				<DialogHeader className="border-b px-6 py-4">
					<DialogTitle>{t("accounts.inviteDialog.title")}</DialogTitle>
					<DialogDescription>{t("accounts.inviteDialog.description")}</DialogDescription>
				</DialogHeader>

				{inviteCode ? (
					<div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
						<Alert tone="success" title={t("accounts.inviteDialog.createdTitle")}>
							<div className="mt-1 flex items-center gap-2">
								<code className="bg-background/60 rounded px-2 py-1 font-mono text-sm font-semibold tracking-wider">
									{inviteCode}
								</code>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={handleCopyCode}
								>
									{codeCopied ? (
										<Check className="size-3.5" aria-hidden />
									) : (
										<Copy className="size-3.5" aria-hidden />
									)}
									{codeCopied ? tc("copied") : t("accounts.inviteDialog.copyCode")}
								</Button>
							</div>
							<p className="text-muted-foreground mt-1.5 text-xs">
								{t("accounts.inviteDialog.codeHint")}
							</p>
						</Alert>
					</div>
				) : (
					<div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
						{!policyEnforced && policyHasPattern && localPartOverridden ? (
							<Alert
								tone="warning"
								title={t("accounts.inviteDialog.policyDivergeTitle")}
								className="border-amber-500/70 bg-amber-50 ring-2 ring-amber-500/30 dark:bg-amber-950/40 dark:ring-amber-500/20"
							>
								<p>
									{t("accounts.inviteDialog.policyDivergeBody", {
										pattern: policyPattern,
									})}
								</p>
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="mt-2 border-amber-600/40"
									onClick={() => setLocalPartOverridden(false)}
								>
									{t("accounts.inviteDialog.revertPolicy")}
								</Button>
							</Alert>
						) : null}

						<div className="grid gap-3 sm:grid-cols-2">
							<div className="space-y-1">
								<label className="text-sm font-medium" htmlFor="invite-domain">
									{t("accounts.inviteDialog.domain")}
								</label>
								<Select
									value={domainId || undefined}
									onValueChange={setDomainId}
									disabled={availableDomains.length === 0}
								>
									<SelectTrigger id="invite-domain">
										<SelectValue placeholder={t("accounts.inviteDialog.selectDomain")} />
									</SelectTrigger>
									<SelectContent>
										{availableDomains.map((domain) =>
											domain.id ? (
												<SelectItem key={domain.id} value={domain.id}>
													{domain.domain}
												</SelectItem>
											) : null,
										)}
									</SelectContent>
								</Select>
							</div>
							{roles.length > 1 ? (
								<div className="space-y-1">
									<label className="text-sm font-medium" htmlFor="invite-role">
										{t("accounts.inviteDialog.role")}
									</label>
									<Select
										value={role}
										onValueChange={(value) => setRole(value as AccountRole)}
									>
										<SelectTrigger id="invite-role">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{roles.map((item) => (
												<SelectItem key={item} value={item}>
													{ROLE_META[item].label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							) : null}
						</div>

						{roles.length > 1 ? (
							<p className="text-muted-foreground -mt-2 text-xs">
								{ROLE_META[role].description}
							</p>
						) : null}

						{availableDomains.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								{t("accounts.inviteDialog.noDomains")}
							</p>
						) : null}

						<div className="space-y-1">
							<label className="text-sm font-medium" htmlFor="invite-local-part">
								{t("accounts.inviteDialog.mailboxAddress")}
							</label>
							<div className="flex items-center gap-2">
								<Input
									id="invite-local-part"
									placeholder={t("accounts.inviteDialog.localPartPlaceholder")}
									value={localPart}
									onChange={(event) => {
										setLocalPart(event.target.value);
										if (!policyEnforced) {
											setLocalPartOverridden(true);
										}
									}}
									disabled={policyEnforced}
									className="flex-1"
								/>
								{selectedDomain?.domain ? (
									<span className="text-muted-foreground shrink-0 text-sm">
										@{selectedDomain.domain}
									</span>
								) : null}
							</div>
							{policyEnforced && policyPattern ? (
								<p className="text-muted-foreground text-xs">
									{t("accounts.inviteDialog.followsPolicy", {
										pattern: policyPattern,
									})}
								</p>
							) : null}
							{!policyEnforced && policyHasPattern && !localPartOverridden ? (
								<p className="text-muted-foreground text-xs">
									{t("accounts.inviteDialog.autoUpdates", {
										pattern: policyPattern,
									})}
								</p>
							) : null}
						</div>

						<CollapsibleSection
							title={t("accounts.inviteDialog.profileSection")}
							description={t("accounts.inviteDialog.profileSectionDesc")}
						>
							<ProfileFieldsGrid
								idPrefix="invite-profile"
								values={profile}
								onChange={(key, value) =>
									setProfile((current) => ({ ...current, [key]: value }))
								}
								requiredFields={new Set(policyRequiredFields)}
								isFieldDisabled={(key) => lockedFields.has(key)}
								inputExtra={(key) => {
									const policyRequired =
										policyEnforced &&
										policyRequiredFields.includes(
											key as "firstName" | "lastName",
										);
									if (canLock && !policyRequired) {
										return (
											<ProfileFieldLockToggle
												locked={lockedFields.has(key)}
												onToggle={() => toggleLock(key)}
											/>
										);
									}
									return null;
								}}
								labelExtra={(key) => {
									const policyRequired =
										policyEnforced &&
										policyRequiredFields.includes(
											key as "firstName" | "lastName",
										);
									if (policyRequired) {
										return (
											<span className="text-muted-foreground text-xs">
												{t("accounts.inviteDialog.requiredByPolicy")}
											</span>
										);
									}
									return null;
								}}
							/>
						</CollapsibleSection>

						{role === "admin" ? (
							<CollapsibleSection
								title={t("accounts.inviteDialog.domainAssignments")}
								description={t("accounts.inviteDialog.domainAssignmentsDesc")}
								defaultOpen
							>
								<div className="space-y-2">
									{availableDomains.map((domain) =>
										domain.id ? (
											<div
												key={domain.id}
												className="flex items-center gap-2 text-sm"
											>
												<Checkbox
													id={`invite-admin-domain-${domain.id}`}
													checked={assignedDomainIds.includes(domain.id)}
													onCheckedChange={() =>
														toggleAssignedDomain(domain.id!)
													}
												/>
												<label
													htmlFor={`invite-admin-domain-${domain.id}`}
													className="cursor-pointer"
												>
													{domain.domain}
												</label>
											</div>
										) : null,
									)}
								</div>
							</CollapsibleSection>
						) : null}

						{role === "manager" ? (
							<CollapsibleSection
								title={t("accounts.inviteDialog.sharedAccess")}
								description={t("accounts.inviteDialog.sharedAccessDesc")}
								defaultOpen
							>
								<div className="mb-3 flex items-center gap-2 text-sm">
									<Checkbox
										id="invite-all-shared-mailboxes"
										checked={allSharedMailboxes}
										onCheckedChange={(checked) => {
											setAllSharedMailboxes(checked === true);
											if (checked === true) {
												setSharedMailboxIds([]);
											}
										}}
									/>
									<label
										htmlFor="invite-all-shared-mailboxes"
										className="cursor-pointer"
									>
										{t("accounts.inviteDialog.allShared")}
									</label>
								</div>
								<div className="mb-3 space-y-2">
									<p className="text-muted-foreground text-xs">
										{t("accounts.inviteDialog.assignedDomains")}
									</p>
									{availableDomains.map((domain) =>
										domain.id ? (
											<div
												key={domain.id}
												className="flex items-center gap-2 text-sm"
											>
												<Checkbox
													id={`invite-manager-domain-${domain.id}`}
													checked={assignedDomainIds.includes(domain.id)}
													onCheckedChange={() =>
														toggleAssignedDomain(domain.id!)
													}
												/>
												<label
													htmlFor={`invite-manager-domain-${domain.id}`}
													className="cursor-pointer"
												>
													{domain.domain}
												</label>
											</div>
										) : null,
									)}
								</div>
								{!allSharedMailboxes ? (
									<div className="space-y-2">
										{sharedMailboxes.length === 0 ? (
											<p className="text-muted-foreground text-sm">
												{t("accounts.inviteDialog.noSharedOnDomains")}
											</p>
										) : (
											sharedMailboxes.map((mailbox) =>
												mailbox.id ? (
													<div
														key={mailbox.id}
														className="flex items-center gap-2 text-sm"
													>
														<Checkbox
															id={`invite-shared-mailbox-${mailbox.id}`}
															checked={sharedMailboxIds.includes(mailbox.id)}
															onCheckedChange={() =>
																toggleSharedMailbox(mailbox.id!)
															}
														/>
														<label
															htmlFor={`invite-shared-mailbox-${mailbox.id}`}
															className="cursor-pointer"
														>
															{mailbox.address}
														</label>
													</div>
												) : null,
											)
										)}
									</div>
								) : null}
							</CollapsibleSection>
						) : null}

						<CollapsibleSection title={t("accounts.inviteDialog.delivery")}>
							<div className="flex items-center gap-2 text-sm">
								<Checkbox
									id="invite-send-email"
									checked={sendInviteEmail}
									onCheckedChange={(checked) =>
										setSendInviteEmail(checked === true)
									}
								/>
								<label htmlFor="invite-send-email" className="cursor-pointer">
									{t("accounts.inviteDialog.sendEmail")}
								</label>
							</div>
						</CollapsibleSection>

						{error ? (
							<Alert tone="destructive" title={t("accounts.inviteDialog.createErrorTitle")}>
								<p>{error}</p>
							</Alert>
						) : null}
					</div>
				)}

				<DialogFooter className="items-center border-t px-6 py-4 sm:justify-between">
					{inviteCode ? (
						<>
							<span />
							<Button onClick={() => handleOpenChange(false)}>
								{t("accounts.inviteDialog.done")}
							</Button>
						</>
					) : (
						<>
							<p className="text-muted-foreground text-xs">
								{!inviteMutation.isPending ? missingRequirement : null}
							</p>
							<div className="flex gap-2">
								<Button
									variant="outline"
									onClick={() => handleOpenChange(false)}
								>
									{tc("cancel")}
								</Button>
								<Button
									onClick={handleInvite}
									disabled={!canSubmit || inviteMutation.isPending}
								>
									{inviteMutation.isPending
										? t("accounts.inviteDialog.creating")
										: t("accounts.inviteDialog.createInvite")}
								</Button>
							</div>
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
