import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDomains } from "@/hooks/use-domains";
import { useMailboxes } from "@/hooks/use-mailboxes";
import {
	useInviteAccount,
	useLocalPartPolicy,
	useSuggestInviteLocalPart,
} from "@/hooks/use-accounts";
import { PROFILE_FIELDS, type AccountRole } from "@/lib/accounts/api";
import { filterDomainsForAccount } from "@/lib/accounts/domains";
import {
	applyLocalPartPattern,
	getProfileFieldsUsedByPattern,
} from "@/lib/accounts/local-part-policy";
import {
	canLockProfileFields,
	inviteableRoles,
} from "@/lib/accounts/permissions";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

const selectClassName =
	"border-input bg-background w-full rounded-md border px-3 py-2 text-sm";

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

export function InviteAccountForm() {
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
		if (!policyEnforced || !policyPattern) {
			return;
		}
		setLockedFields((current) => {
			const next = new Set(current);
			for (const field of policyRequiredFields) {
				next.add(field);
			}
			return next;
		});
	}, [policyEnforced, policyPattern, policyRequiredFields]);

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

	const canSubmit =
		!!domainId &&
		!!localPart.trim() &&
		(!policyEnforced || requiredProfileComplete) &&
		(role !== "admin" || assignedDomainIds.length > 0) &&
		(role !== "manager" || assignedDomainIds.length > 0);

	const handleInvite = () => {
		setError(null);
		setInviteCode(null);
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
					setProfile(emptyProfile());
					setLocalPart("");
					setLocalPartOverridden(false);
					setLockedFields(new Set());
					setAssignedDomainIds([]);
					setSharedMailboxIds([]);
					setAllSharedMailboxes(false);
					setSendInviteEmail(false);
				},
				onError: (err) => setError(getErrorMessage(err)),
			},
		);
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Invite account</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid gap-3 sm:grid-cols-2">
					<div className="space-y-1">
						<label className="text-sm font-medium">Domain</label>
						<select
							className={selectClassName}
							value={domainId}
							onChange={(event) => setDomainId(event.target.value)}
						>
							<option value="">Select domain</option>
							{availableDomains.map((domain) => (
								<option key={domain.id} value={domain.id ?? ""}>
									{domain.domain}
								</option>
							))}
						</select>
					</div>
					{roles.length > 1 ? (
						<div className="space-y-1">
							<label className="text-sm font-medium">Role</label>
							<select
								className={selectClassName}
								value={role}
								onChange={(event) => setRole(event.target.value as AccountRole)}
							>
								{roles.map((item) => (
									<option key={item} value={item}>
										{item}
									</option>
								))}
							</select>
						</div>
					) : null}
				</div>

				{availableDomains.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No domains available for your account.
					</p>
				) : null}

				<div className="space-y-1">
					<label className="text-sm font-medium">Mailbox address</label>
					<div className="flex items-center gap-2">
						<Input
							placeholder="patrick"
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
							Local part follows policy: {policyPattern}
						</p>
					) : null}
					{!policyEnforced && policyHasPattern && localPartOverridden ? (
						<p className="text-muted-foreground text-xs">
							You customized the local part. It will not auto-update when profile
							fields change.{" "}
							<button
								type="button"
								className="text-primary hover:underline"
								onClick={() => setLocalPartOverridden(false)}
							>
								Use policy suggestion
							</button>
						</p>
					) : null}
					{!policyEnforced && policyHasPattern && !localPartOverridden ? (
						<p className="text-muted-foreground text-xs">
							Auto-updates from policy: {policyPattern}
						</p>
					) : null}
				</div>

				<CollapsibleSection
					title="Profile"
					description="Pre-fill onboarding details. Locked fields cannot be changed during activation."
				>
					<div className="space-y-3">
						{PROFILE_FIELDS.map((field) => {
							const policyLocked =
								policyEnforced &&
								policyRequiredFields.includes(
									field.key as "firstName" | "lastName",
								);
							const isLocked = lockedFields.has(field.key);
							const isRequired = policyLocked;
							const inputId = `invite-profile-${field.key}`;

							return (
								<div key={field.key} className="space-y-1">
									<div className="flex items-center justify-between gap-2">
										<label htmlFor={inputId} className="text-sm font-medium">
											{field.label}
											{isRequired ? (
												<span className="text-destructive ml-1">*</span>
											) : null}
										</label>
										{canLock && !policyLocked ? (
											<label className="text-muted-foreground flex items-center gap-1 text-xs">
												<input
													type="checkbox"
													checked={isLocked}
													onChange={() => toggleLock(field.key)}
												/>
												Lock
											</label>
										) : policyLocked ? (
											<span className="text-muted-foreground text-xs">
												Required by policy
											</span>
										) : null}
									</div>
									<Input
										id={inputId}
										value={profile[field.key as keyof ProfileFormState]}
										onChange={(event) =>
											setProfile((current) => ({
												...current,
												[field.key]: event.target.value,
											}))
										}
										required={isRequired}
									/>
								</div>
							);
						})}
					</div>
				</CollapsibleSection>

				{role === "admin" ? (
					<CollapsibleSection
						title="Domain assignments"
						description="Domains this admin can manage."
						defaultOpen
					>
						<div className="space-y-2">
							{availableDomains.map((domain) =>
								domain.id ? (
									<label
										key={domain.id}
										className="flex items-center gap-2 text-sm"
									>
										<input
											type="checkbox"
											checked={assignedDomainIds.includes(domain.id)}
											onChange={() => toggleAssignedDomain(domain.id!)}
										/>
										{domain.domain}
									</label>
								) : null,
							)}
						</div>
					</CollapsibleSection>
				) : null}

				{role === "manager" ? (
					<CollapsibleSection
						title="Shared mailbox access"
						description="Shared mailboxes this manager can administer."
						defaultOpen
					>
						<label className="mb-3 flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={allSharedMailboxes}
								onChange={(event) => {
									setAllSharedMailboxes(event.target.checked);
									if (event.target.checked) {
										setSharedMailboxIds([]);
									}
								}}
							/>
							All shared mailboxes on assigned domains
						</label>
						<div className="mb-3 space-y-2">
							<p className="text-muted-foreground text-xs">Assigned domains</p>
							{availableDomains.map((domain) =>
								domain.id ? (
									<label
										key={domain.id}
										className="flex items-center gap-2 text-sm"
									>
										<input
											type="checkbox"
											checked={assignedDomainIds.includes(domain.id)}
											onChange={() => toggleAssignedDomain(domain.id!)}
										/>
										{domain.domain}
									</label>
								) : null,
							)}
						</div>
						{!allSharedMailboxes ? (
							<div className="space-y-2">
								{sharedMailboxes.length === 0 ? (
									<p className="text-muted-foreground text-sm">
										No shared mailboxes on the selected domains.
									</p>
								) : (
									sharedMailboxes.map((mailbox) =>
										mailbox.id ? (
											<label
												key={mailbox.id}
												className="flex items-center gap-2 text-sm"
											>
												<input
													type="checkbox"
													checked={sharedMailboxIds.includes(mailbox.id)}
													onChange={() => toggleSharedMailbox(mailbox.id!)}
												/>
												{mailbox.address}
											</label>
										) : null,
									)
								)}
							</div>
						) : null}
					</CollapsibleSection>
				) : null}

				<CollapsibleSection title="Delivery">
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							checked={sendInviteEmail}
							onChange={(event) => setSendInviteEmail(event.target.checked)}
						/>
						Send invite code to recovery address (logs only for now)
					</label>
				</CollapsibleSection>

				{error ? <p className="text-destructive text-sm">{error}</p> : null}
				{inviteCode ? (
					<div className="bg-muted rounded-md px-4 py-3 text-sm">
						<p className="font-medium">Invite created</p>
						<p>
							Code: <strong className="font-mono">{inviteCode}</strong>
						</p>
					</div>
				) : null}

				<Button
					onClick={handleInvite}
					disabled={!canSubmit || inviteMutation.isPending}
				>
					Create invite
				</Button>
			</CardContent>
		</Card>
	);
}
