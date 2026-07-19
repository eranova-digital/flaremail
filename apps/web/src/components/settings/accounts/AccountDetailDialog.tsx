import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Loader2, MoreHorizontal } from "lucide-react";

import { AccountIdentitiesTab } from "@/components/settings/accounts/AccountIdentitiesTab";
import { AccountLogsTab } from "@/components/settings/accounts/AccountLogsTab";
import { AccountSecurityTab } from "@/components/settings/accounts/AccountSecurityTab";
import { ProfileFieldsGrid } from "@/components/settings/ProfileFieldsGrid";
import { ProfileFieldLockToggle } from "@/components/settings/accounts/ProfileFieldLockToggle";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDomains } from "@/hooks/use-domains";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { useQueryClient } from "@tanstack/react-query";
import {
	accountQueryKeys,
	useAccount,
	useAssignAccountRole,
	useCreatePasswordResetCode,
	useRegenerateInviteCode,
	useRemoveAccount,
	useSuspendAccount,
	useUnsuspendAccount,
	useUpdateAccount,
	useUpdateAccountAssignments,
} from "@/hooks/use-accounts";
import type { AccountRole } from "@/lib/accounts/api";
import { filterDomainsForAccount } from "@/lib/accounts/domains";
import {
	canAssignRoles,
	canAccessLogsTab,
	canLockProfileFields,
	canManageAssignments,
	canManageTarget,
	canManageUserMailboxGrants,
	canManageTargetSecurity,
	canRemoveTarget,
	canSuspendTarget,
	inviteableRoles,
} from "@/lib/accounts/permissions";
import { ROLE_META, roleLabel, statusMeta } from "@/lib/accounts/roles";
import { useAuth } from "@/lib/auth/AuthProvider";
import { apiUrl } from "@/lib/api";
import { getErrorMessage } from "@/lib/api/errors";

type AccountDetailDialogProps = {
	accountId: string | null;
	onClose: () => void;
};

function AccessSection({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: ReactNode;
}) {
	return (
		<div className="bg-muted/30 space-y-3 rounded-lg border p-4">
			<div>
				<p className="text-sm font-medium">{title}</p>
				{description ? (
					<p className="text-muted-foreground text-xs">{description}</p>
				) : null}
			</div>
			{children}
		</div>
	);
}

export function AccountDetailDialog({
	accountId,
	onClose,
}: AccountDetailDialogProps) {
	const { account: actor } = useAuth();
	const queryClient = useQueryClient();
	const pictureInputRef = useRef<HTMLInputElement>(null);
	const [pictureBusy, setPictureBusy] = useState(false);
	const [pictureError, setPictureError] = useState<string | null>(null);
	const domainsQuery = useDomains();
	const mailboxesQuery = useMailboxes("manage");
	const detailQuery = useAccount(accountId);
	const updateMutation = useUpdateAccount();
	const assignmentsMutation = useUpdateAccountAssignments();
	const assignMutation = useAssignAccountRole();
	const suspendMutation = useSuspendAccount();
	const unsuspendMutation = useUnsuspendAccount();
	const removeMutation = useRemoveAccount();
	const resetCodeMutation = useCreatePasswordResetCode();
	const regenerateInviteMutation = useRegenerateInviteCode();

	const [activeTab, setActiveTab] = useState("profile");
	const [role, setRole] = useState<AccountRole>("user");
	const [lockedFields, setLockedFields] = useState<Set<string>>(new Set());
	const [profileValues, setProfileValues] = useState<Record<string, string>>({});
	const [assignedDomainIds, setAssignedDomainIds] = useState<string[]>([]);
	const [sharedMailboxIds, setSharedMailboxIds] = useState<string[]>([]);
	const [grantedMailboxIds, setGrantedMailboxIds] = useState<string[]>([]);
	const [allSharedMailboxes, setAllSharedMailboxes] = useState(false);
	const [resetCode, setResetCode] = useState<string | null>(null);
	const [inviteCode, setInviteCode] = useState<string | null>(null);
	const [confirmingRemove, setConfirmingRemove] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const target = detailQuery.data;
	const availableDomains = useMemo(
		() => filterDomainsForAccount(actor, domainsQuery.data ?? []),
		[actor, domainsQuery.data],
	);

	const sharedMailboxes = useMemo(() => {
		const domainFilter =
			role === "manager" && assignedDomainIds.length > 0
				? new Set(assignedDomainIds)
				: new Set<string>();
		return (mailboxesQuery.data ?? []).filter((mailbox) => {
			if (mailbox.type !== "shared" || !mailbox.id || !mailbox.domainId) {
				return false;
			}
			if (role === "manager") {
				return domainFilter.has(mailbox.domainId);
			}
			return true;
		});
	}, [assignedDomainIds, mailboxesQuery.data, role]);

	const grantableSharedMailboxes = useMemo(
		() =>
			(mailboxesQuery.data ?? []).filter(
				(mailbox) => mailbox.type === "shared" && mailbox.id,
			),
		[mailboxesQuery.data],
	);

	const showAccessTab =
		(canAssignRoles(actor) && !!target?.role) ||
		(canManageAssignments(actor) &&
			(target?.role === "admin" || target?.role === "manager")) ||
		(canManageUserMailboxGrants(actor) && !!target?.role);

	const showSecurityTab = !!target && canManageTargetSecurity(actor, target);
	const showIdentitiesTab = Boolean(target?.primaryMailboxId);
	const showLogsTab = canAccessLogsTab(actor);
	const showTabs =
		showAccessTab || showSecurityTab || showIdentitiesTab || showLogsTab;

	useEffect(() => {
		if (!accountId) {
			setActiveTab("profile");
			setResetCode(null);
			setInviteCode(null);
			setError(null);
		}
	}, [accountId]);

	useEffect(() => {
		if (!target) {
			return;
		}
		setProfileValues({
			firstName: target.profile?.firstName ?? "",
			lastName: target.profile?.lastName ?? "",
			recoveryAddress: target.profile?.recoveryAddress ?? "",
			phone: target.profile?.phone ?? "",
			addressCountry: target.profile?.address?.country ?? "",
			addressState: target.profile?.address?.state ?? "",
			addressCity: target.profile?.address?.city ?? "",
			addressLine1: target.profile?.address?.line1 ?? "",
			addressLine2: target.profile?.address?.line2 ?? "",
		});
		setLockedFields(new Set(target.lockedFields));
		setAssignedDomainIds(target.domainIds);
		setSharedMailboxIds(target.sharedMailboxIds);
		setGrantedMailboxIds(target.grantedMailboxIds ?? []);
		setAllSharedMailboxes(target.allSharedMailboxes);
		if (target.role) {
			setRole(target.role);
		}
		setResetCode(null);
		setInviteCode(null);
		setError(null);
	}, [target]);

	const toggleLock = (field: string) => {
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

	const toggleGrantedMailbox = (id: string) => {
		setGrantedMailboxIds((current) =>
			current.includes(id)
				? current.filter((item) => item !== id)
				: [...current, id],
		);
	};

	const handleSaveAll = async () => {
		if (!accountId || !target) {
			return;
		}
		setError(null);
		setSaving(true);

		try {
			await updateMutation.mutateAsync({
				id: accountId,
				body: {
					profile: {
						firstName: profileValues.firstName,
						lastName: profileValues.lastName,
						recoveryAddress: profileValues.recoveryAddress || null,
						phone: profileValues.phone || null,
						address: {
							country: profileValues.addressCountry || null,
							state: profileValues.addressState || null,
							city: profileValues.addressCity || null,
							line1: profileValues.addressLine1 || null,
							line2: profileValues.addressLine2 || null,
						},
					},
					lockedFields: canLockProfileFields(actor)
						? [...lockedFields]
						: undefined,
				},
			});

			const roleChanged =
				canAssignRoles(actor) && target.role && role !== target.role;

			if (roleChanged) {
				await assignMutation.mutateAsync({
					accountId,
					role,
					domainIds:
						role === "admin" || role === "manager"
							? assignedDomainIds
							: undefined,
				});
			}

			if (
				canManageAssignments(actor) &&
				(role === "admin" || role === "manager") &&
				!roleChanged
			) {
				await assignmentsMutation.mutateAsync({
					id: accountId,
					body: {
						domainIds: assignedDomainIds,
						allSharedMailboxes: role === "manager" ? allSharedMailboxes : undefined,
						sharedMailboxIds:
							role === "manager" && !allSharedMailboxes
								? sharedMailboxIds
								: undefined,
					},
				});
			}

			if (role === "manager" && roleChanged) {
				await assignmentsMutation.mutateAsync({
					id: accountId,
					body: {
						allSharedMailboxes,
						sharedMailboxIds: !allSharedMailboxes ? sharedMailboxIds : undefined,
					},
				});
			}

			if (canManageUserMailboxGrants(actor) && role) {
				await assignmentsMutation.mutateAsync({
					id: accountId,
					body: { grantedMailboxIds },
				});
			}
		} catch (err) {
			setError(getErrorMessage(err));
		} finally {
			setSaving(false);
		}
	};

	const isBusy =
		saving ||
		updateMutation.isPending ||
		assignmentsMutation.isPending ||
		assignMutation.isPending ||
		pictureBusy;

	const canManagePicture = !!target && canManageTarget(actor, target);

	const handlePictureUpload = async (file: File, accountId: string) => {
		setPictureBusy(true);
		setPictureError(null);
		try {
			const formData = new FormData();
			formData.append("file", file);
			const response = await fetch(apiUrl(`/accounts/${accountId}/profile-picture`), {
				method: "PUT",
				credentials: "include",
				body: formData,
			});
			if (!response.ok) {
				const body = await response.json().catch(() => null);
				throw new Error(getErrorMessage(body) ?? "Upload failed");
			}
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: accountQueryKeys.detail(accountId) }),
				queryClient.invalidateQueries({ queryKey: accountQueryKeys.all }),
			]);
		} catch (err) {
			setPictureError(getErrorMessage(err));
		} finally {
			setPictureBusy(false);
			if (pictureInputRef.current) {
				pictureInputRef.current.value = "";
			}
		}
	};

	const handlePictureRemove = async (accountId: string) => {
		setPictureBusy(true);
		setPictureError(null);
		try {
			const response = await fetch(apiUrl(`/accounts/${accountId}/profile-picture`), {
				method: "DELETE",
				credentials: "include",
			});
			if (!response.ok) {
				const body = await response.json().catch(() => null);
				throw new Error(getErrorMessage(body) ?? "Remove failed");
			}
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: accountQueryKeys.detail(accountId) }),
				queryClient.invalidateQueries({ queryKey: accountQueryKeys.all }),
			]);
		} catch (err) {
			setPictureError(getErrorMessage(err));
		} finally {
			setPictureBusy(false);
		}
	};

	return (
		<Dialog open={!!accountId} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-2xl">
				<DialogHeader className="border-b px-6 py-4">
					{target ? (
						<div className="flex items-start gap-4 pr-8">
							<input
								ref={pictureInputRef}
								type="file"
								accept="image/jpeg,image/png,image/webp"
								className="sr-only"
								disabled={!canManagePicture || isBusy}
								onChange={(event) => {
									const file = event.target.files?.[0];
									if (file && target) {
										void handlePictureUpload(file, target.id);
									}
								}}
							/>
							{canManagePicture ? (
								<DropdownMenu modal={false}>
									<DropdownMenuTrigger asChild>
										<button
											type="button"
											disabled={isBusy}
											className="group relative cursor-pointer rounded-full outline-none disabled:cursor-not-allowed"
											aria-label="Profile picture actions"
										>
											<ProfileAvatar
												accountId={target.id}
												seed={target.loginIdentifier}
												label={target.displayName}
												profilePicture={target.profilePicture}
												className="size-12 text-sm transition group-hover:ring-2 group-hover:ring-ring/40 group-hover:ring-offset-2 group-hover:ring-offset-background group-active:ring-ring/60 group-disabled:ring-0"
											/>
											<span
												aria-hidden
												className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-transparent transition group-hover:ring-ring/20 group-disabled:ring-transparent"
											/>
										</button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="start">
										<DropdownMenuItem
											disabled={isBusy}
											onSelect={() => pictureInputRef.current?.click()}
										>
											{target.profilePicture ? "Change photo" : "Upload photo"}
										</DropdownMenuItem>
										{target.profilePicture ? (
											<DropdownMenuItem
												disabled={isBusy}
												onSelect={() => void handlePictureRemove(target.id)}
											>
												Remove photo
											</DropdownMenuItem>
										) : null}
									</DropdownMenuContent>
								</DropdownMenu>
							) : (
								<ProfileAvatar
									accountId={target.id}
									seed={target.loginIdentifier}
									label={target.displayName}
									profilePicture={target.profilePicture}
									className="size-12 text-sm"
								/>
							)}
							<div className="min-w-0 flex-1">
								<DialogTitle>{target.displayName}</DialogTitle>
								<DialogDescription asChild>
									<div className="flex flex-wrap items-center gap-2 pt-1">
										<span>{target.loginIdentifier}</span>
										<Badge variant="outline">
											{roleLabel(target.role, target.isIntendant)}
										</Badge>
										<Badge
											variant={
												statusMeta(target.status).tone === "success"
													? "success"
													: statusMeta(target.status).tone === "warning"
														? "warning"
														: "secondary"
											}
										>
											{statusMeta(target.status).label}
										</Badge>
									</div>
								</DialogDescription>
							</div>
						</div>
					) : (
						<DialogTitle>Account</DialogTitle>
					)}
				</DialogHeader>

				{detailQuery.isLoading ? (
					<div className="text-muted-foreground px-6 py-8 text-sm">Loading…</div>
				) : detailQuery.isError ? (
					<div className="px-6 py-4">
						<Alert tone="destructive">
							<p>{getErrorMessage(detailQuery.error)}</p>
						</Alert>
					</div>
				) : !target ? (
					<div className="px-6 py-4">
						<Alert tone="warning">
							<p>Account not found.</p>
						</Alert>
					</div>
				) : (
					<>
						<Tabs
							value={activeTab}
							onValueChange={setActiveTab}
							className="flex min-h-0 flex-1 flex-col"
						>
							{showTabs ? (
								<div className="border-b px-6 py-3">
									<TabsList className="h-10 w-fit gap-1 p-1.5">
										<TabsTrigger className="h-7 px-4" value="profile">
											Profile
										</TabsTrigger>
										{showAccessTab ? (
											<TabsTrigger className="h-7 px-4" value="access">
												Access
											</TabsTrigger>
										) : null}
										{showIdentitiesTab ? (
											<TabsTrigger className="h-7 px-4" value="identities">
												Identities
											</TabsTrigger>
										) : null}
										{showSecurityTab ? (
											<TabsTrigger className="h-7 px-4" value="security">
												Security
											</TabsTrigger>
										) : null}
										{showLogsTab ? (
											<TabsTrigger className="h-7 px-4" value="logs">
												Logs
											</TabsTrigger>
										) : null}
									</TabsList>
								</div>
							) : null}

							<div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
								<TabsContent value="profile" className="mt-0 space-y-4">
									<ProfileFieldsGrid
										idPrefix="account-detail"
										values={profileValues}
										disabled={isBusy}
										onChange={(key, value) =>
											setProfileValues((current) => ({
												...current,
												[key]: value,
											}))
										}
										isFieldDisabled={(key) =>
											(actor?.id === target.id &&
												target.lockedFields.includes(key)) ||
											(canLockProfileFields(actor) &&
												actor?.id !== target.id &&
												lockedFields.has(key))
										}
										inputExtra={(key) => {
											if (
												canLockProfileFields(actor) &&
												actor?.id !== target.id
											) {
												return (
													<ProfileFieldLockToggle
														locked={lockedFields.has(key)}
														onToggle={() => toggleLock(key)}
														disabled={isBusy}
													/>
												);
											}
											return null;
										}}
										labelExtra={(key) => {
											if (
												target.lockedFields.includes(key) &&
												actor?.id === target.id
											) {
												return (
													<span className="text-muted-foreground text-xs">
														Locked
													</span>
												);
											}
											return null;
										}}
									/>
								</TabsContent>

								{showAccessTab ? (
									<TabsContent value="access" className="mt-0 space-y-4">
										{canAssignRoles(actor) && target.role ? (
											<AccessSection
												title="Role"
												description="What this person can do in Flaremail."
											>
												<Select
													value={role}
													onValueChange={(value) =>
														setRole(value as AccountRole)
													}
													disabled={isBusy}
												>
													<SelectTrigger id="account-role">
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														{inviteableRoles(actor).map((item) => (
															<SelectItem key={item} value={item}>
																{ROLE_META[item].label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
												<p className="text-muted-foreground text-xs">
													{ROLE_META[role].description}
												</p>
												{role !== target.role ? (
													<p className="text-muted-foreground text-xs">
														Role change is applied when you save.
													</p>
												) : null}
											</AccessSection>
										) : null}

										{canManageAssignments(actor) &&
										(role === "admin" || role === "manager") ? (
											<AccessSection
												title="Managed domains"
												description={
													role === "admin"
														? "Domains this admin can manage."
														: "Domains this manager is assigned to."
												}
											>
												<div className="grid gap-2 sm:grid-cols-2">
													{availableDomains.map((domain) =>
														domain.id ? (
															<div
																key={domain.id}
																className="flex items-center gap-2 text-sm"
															>
																<Checkbox
																	id={`assigned-domain-${domain.id}`}
																	checked={assignedDomainIds.includes(
																		domain.id,
																	)}
																	onCheckedChange={() =>
																		toggleAssignedDomain(domain.id!)
																	}
																	disabled={isBusy}
																/>
																<label
																	htmlFor={`assigned-domain-${domain.id}`}
																	className="cursor-pointer"
																>
																	{domain.domain}
																</label>
															</div>
														) : null,
													)}
												</div>
											</AccessSection>
										) : null}

										{canManageAssignments(actor) && role === "manager" ? (
											<AccessSection
												title="Shared mailbox administration"
												description="Shared mailboxes this manager can administer."
											>
												<div className="flex items-center gap-2 text-sm">
													<Checkbox
														id="all-shared-mailboxes"
														checked={allSharedMailboxes}
														onCheckedChange={(checked) => {
															setAllSharedMailboxes(checked === true);
															if (checked === true) {
																setSharedMailboxIds([]);
															}
														}}
														disabled={isBusy}
													/>
													<label
														htmlFor="all-shared-mailboxes"
														className="cursor-pointer"
													>
														All shared mailboxes on assigned domains
													</label>
												</div>
												{!allSharedMailboxes ? (
													<div className="grid gap-2 sm:grid-cols-2">
														{sharedMailboxes.length === 0 ? (
															<p className="text-muted-foreground col-span-full text-sm">
																No shared mailboxes on the selected domains.
															</p>
														) : (
															sharedMailboxes.map((mailbox) =>
																mailbox.id ? (
																	<div
																		key={mailbox.id}
																		className="flex items-center gap-2 text-sm"
																	>
																		<Checkbox
																			id={`shared-mailbox-${mailbox.id}`}
																			checked={sharedMailboxIds.includes(
																				mailbox.id,
																			)}
																			onCheckedChange={() =>
																				toggleSharedMailbox(mailbox.id!)
																			}
																			disabled={isBusy}
																		/>
																		<label
																			htmlFor={`shared-mailbox-${mailbox.id}`}
																			className="cursor-pointer truncate"
																		>
																			{mailbox.address}
																		</label>
																	</div>
																) : null,
															)
														)}
													</div>
												) : null}
											</AccessSection>
										) : null}

										{canManageUserMailboxGrants(actor) && role ? (
											<AccessSection
												title="Shared mailbox access"
												description="Shared mailboxes this account can read and send from."
											>
												<div className="grid gap-2 sm:grid-cols-2">
													{grantableSharedMailboxes.length === 0 ? (
														<p className="text-muted-foreground col-span-full text-sm">
															No shared mailboxes available.
														</p>
													) : (
														grantableSharedMailboxes.map((mailbox) =>
															mailbox.id ? (
																<div
																	key={mailbox.id}
																	className="flex items-center gap-2 text-sm"
																>
																	<Checkbox
																		id={`granted-mailbox-${mailbox.id}`}
																		checked={grantedMailboxIds.includes(
																			mailbox.id,
																		)}
																		onCheckedChange={() =>
																			toggleGrantedMailbox(mailbox.id!)
																		}
																		disabled={isBusy}
																	/>
																	<label
																		htmlFor={`granted-mailbox-${mailbox.id}`}
																		className="cursor-pointer truncate"
																	>
																		{mailbox.address}
																	</label>
																</div>
															) : null,
														)
													)}
												</div>
											</AccessSection>
										) : null}
									</TabsContent>
								) : null}

								{showIdentitiesTab && target.primaryMailboxId ? (
									<TabsContent value="identities" className="mt-0 space-y-4">
										<AccountIdentitiesTab
											accountId={target.id}
											mailboxId={target.primaryMailboxId}
											mailboxAddress={target.loginIdentifier}
											displayName={target.displayName}
										/>
									</TabsContent>
								) : null}

								{showSecurityTab && accountId ? (
									<TabsContent value="security" className="mt-0 space-y-4">
										<AccountSecurityTab
											accountId={accountId}
											displayName={target.displayName}
										/>
									</TabsContent>
								) : null}

								{showLogsTab && accountId ? (
									<TabsContent value="logs" className="mt-0 space-y-4">
										<AccountLogsTab
											accountId={accountId}
											invitedBy={target.invitedBy}
										/>
									</TabsContent>
								) : null}

								{resetCode ? (
									<Alert tone="success" title="Password reset code issued">
										<p>
											<code className="font-mono font-semibold tracking-wider">
												{resetCode}
											</code>
										</p>
										<p className="text-muted-foreground mt-1 text-xs">
											Share this code with the person so they can set a new
											password. It is shown only once.
										</p>
									</Alert>
								) : null}
								{inviteCode ? (
									<Alert tone="success" title="New invite code">
										<p>
											<code className="font-mono font-semibold tracking-wider">
												{inviteCode}
											</code>
										</p>
										<p className="text-muted-foreground mt-1 text-xs">
											Share this code with the person to complete activation.
											Previous unused codes were invalidated.
										</p>
									</Alert>
								) : null}
								{error ? (
									<Alert tone="destructive" title="Couldn't save changes">
										<p>{error}</p>
									</Alert>
								) : null}
								{pictureError ? (
									<Alert tone="destructive" title="Couldn't update photo">
										<p>{pictureError}</p>
									</Alert>
								) : null}
							</div>
						</Tabs>

						<DialogFooter className="items-center border-t px-6 py-4 sm:justify-between">
							<DropdownMenu modal={false}>
								<DropdownMenuTrigger asChild>
									<Button variant="outline" size="sm" disabled={isBusy}>
										<MoreHorizontal className="size-4" />
										Account actions
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start">
									{target.status === "pending" ? (
										<DropdownMenuItem
											onClick={() =>
												regenerateInviteMutation.mutate(target.id, {
													onSuccess: (code) => setInviteCode(code),
													onError: (err) => setError(getErrorMessage(err)),
												})
											}
											disabled={regenerateInviteMutation.isPending}
										>
											Show invite code
										</DropdownMenuItem>
									) : null}
									<DropdownMenuItem
										onClick={() =>
											resetCodeMutation.mutate(target.id, {
												onSuccess: (code) => setResetCode(code),
												onError: (err) => setError(getErrorMessage(err)),
											})
										}
										disabled={resetCodeMutation.isPending}
									>
										Issue reset code
									</DropdownMenuItem>
									{canSuspendTarget(actor, target) &&
									target.status !== "suspended" ? (
										<DropdownMenuItem
											onClick={() =>
												suspendMutation.mutate(target.id, {
													onSuccess: onClose,
													onError: (err) => setError(getErrorMessage(err)),
												})
											}
										>
											Suspend account
										</DropdownMenuItem>
									) : null}
									{canSuspendTarget(actor, target) &&
									target.status === "suspended" ? (
										<DropdownMenuItem
											onClick={() =>
												unsuspendMutation.mutate(target.id, {
													onSuccess: onClose,
													onError: (err) => setError(getErrorMessage(err)),
												})
											}
										>
											Unsuspend account
										</DropdownMenuItem>
									) : null}
									{canRemoveTarget(actor, target) ? (
										<>
											<DropdownMenuSeparator />
											<DropdownMenuItem
												className="text-destructive focus:text-destructive"
												onClick={() => setConfirmingRemove(true)}
											>
												Remove account
											</DropdownMenuItem>
										</>
									) : null}
								</DropdownMenuContent>
							</DropdownMenu>

							<div className="flex gap-2">
								<Button variant="outline" onClick={onClose} disabled={isBusy}>
									Cancel
								</Button>
								<Button onClick={handleSaveAll} disabled={isBusy}>
									{saving ? (
										<Loader2 className="size-4 animate-spin" aria-hidden />
									) : null}
									{saving ? "Saving…" : "Save changes"}
								</Button>
							</div>
						</DialogFooter>

						<ConfirmDialog
							open={confirmingRemove}
							onOpenChange={setConfirmingRemove}
							title={`Remove ${target.displayName}?`}
							description={
								<>
									<p>
										This permanently removes the account and its mailbox
										access.
									</p>
									<p>This cannot be undone.</p>
								</>
							}
							confirmLabel="Remove account"
							onConfirm={() =>
								removeMutation.mutate(target.id, {
									onSuccess: () => {
										setConfirmingRemove(false);
										onClose();
									},
									onError: (err) => {
										setConfirmingRemove(false);
										setError(getErrorMessage(err));
									},
								})
							}
							pending={removeMutation.isPending}
						/>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
