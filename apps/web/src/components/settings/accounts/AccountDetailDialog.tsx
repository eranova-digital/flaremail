import { useEffect, useMemo, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDomains } from "@/hooks/use-domains";
import { useMailboxes } from "@/hooks/use-mailboxes";
import {
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
import { PROFILE_FIELDS, type AccountRole } from "@/lib/accounts/api";
import { filterDomainsForAccount } from "@/lib/accounts/domains";
import {
	canAssignRoles,
	canLockProfileFields,
	canManageAssignments,
	canManageUserMailboxGrants,
	canRemoveTarget,
	canSuspendTarget,
	inviteableRoles,
} from "@/lib/accounts/permissions";
import { ROLE_META, roleLabel, statusMeta } from "@/lib/accounts/roles";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getErrorMessage } from "@/lib/api/errors";

const selectClassName =
	"border-input bg-background w-full rounded-md border px-3 py-2 text-sm";

type AccountDetailDialogProps = {
	accountId: string | null;
	onClose: () => void;
};

export function AccountDetailDialog({
	accountId,
	onClose,
}: AccountDetailDialogProps) {
	const { account: actor } = useAuth();
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

	const target = detailQuery.data;
	const availableDomains = useMemo(
		() => filterDomainsForAccount(actor, domainsQuery.data ?? []),
		[actor, domainsQuery.data],
	);

	const sharedMailboxes = useMemo(() => {
		const domainFilter =
			target?.role === "manager" && assignedDomainIds.length > 0
				? new Set(assignedDomainIds)
				: new Set<string>();
		return (mailboxesQuery.data ?? []).filter((mailbox) => {
			if (mailbox.type !== "shared" || !mailbox.id || !mailbox.domainId) {
				return false;
			}
			if (target?.role === "manager") {
				return domainFilter.has(mailbox.domainId);
			}
			return true;
		});
	}, [assignedDomainIds, mailboxesQuery.data, target?.role]);

	const grantableSharedMailboxes = useMemo(
		() =>
			(mailboxesQuery.data ?? []).filter(
				(mailbox) => mailbox.type === "shared" && mailbox.id,
			),
		[mailboxesQuery.data],
	);

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

	const handleSave = () => {
		if (!accountId) {
			return;
		}
		setError(null);
		updateMutation.mutate(
			{
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
			},
			{
				onError: (err) => setError(getErrorMessage(err)),
			},
		);
	};

	const toggleGrantedMailbox = (id: string) => {
		setGrantedMailboxIds((current) =>
			current.includes(id)
				? current.filter((item) => item !== id)
				: [...current, id],
		);
	};

	const handleSaveAssignments = () => {
		if (!accountId || !target) {
			return;
		}
		setError(null);
		assignmentsMutation.mutate(
			{
				id: accountId,
				body: {
					domainIds: assignedDomainIds,
					allSharedMailboxes:
						target.role === "manager" ? allSharedMailboxes : undefined,
					sharedMailboxIds:
						target.role === "manager" && !allSharedMailboxes
							? sharedMailboxIds
							: undefined,
				},
			},
			{
				onError: (err) => setError(getErrorMessage(err)),
			},
		);
	};

	const handleSaveUserGrants = () => {
		if (!accountId) {
			return;
		}
		setError(null);
		assignmentsMutation.mutate(
			{
				id: accountId,
				body: {
					grantedMailboxIds,
				},
			},
			{
				onError: (err) => setError(getErrorMessage(err)),
			},
		);
	};

	const handleAssignRole = () => {
		if (!accountId) {
			return;
		}
		assignMutation.mutate(
			{
				accountId,
				role,
				domainIds:
					role === "admin" || role === "manager" ? assignedDomainIds : undefined,
			},
			{
				onError: (err) => setError(getErrorMessage(err)),
			},
		);
	};

	return (
		<Dialog open={!!accountId} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{target?.displayName ?? "Account"}</DialogTitle>
				</DialogHeader>

				{detailQuery.isLoading ? (
					<p className="text-muted-foreground text-sm">Loading…</p>
				) : detailQuery.isError ? (
					<Alert tone="destructive">
						<p>{getErrorMessage(detailQuery.error)}</p>
					</Alert>
				) : !target ? (
					<Alert tone="warning">
						<p>Account not found.</p>
					</Alert>
				) : (
					<div className="space-y-4">
						<div className="flex flex-wrap items-center gap-2 text-sm">
							<span className="text-muted-foreground">
								{target.loginIdentifier}
							</span>
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

						<div className="space-y-3">
							{PROFILE_FIELDS.map((field) => {
								const isLocked =
									target.lockedFields.includes(field.key) &&
									actor?.id === target.id;
								return (
									<div key={field.key} className="space-y-1">
										<div className="flex items-center justify-between gap-2">
											<label className="text-sm font-medium">{field.label}</label>
											{canLockProfileFields(actor) && actor?.id !== target.id ? (
												<label className="text-muted-foreground flex items-center gap-1 text-xs">
													<input
														type="checkbox"
														checked={lockedFields.has(field.key)}
														onChange={() => toggleLock(field.key)}
													/>
													Lock
												</label>
											) : null}
										</div>
										<Input
											value={profileValues[field.key] ?? ""}
											disabled={isLocked}
											onChange={(event) =>
												setProfileValues((current) => ({
													...current,
													[field.key]: event.target.value,
												}))
											}
										/>
									</div>
								);
							})}
						</div>

						{canAssignRoles(actor) && target.role ? (
							<div className="space-y-2">
								<label className="text-sm font-medium">Role</label>
								<select
									className={selectClassName}
									value={role}
									onChange={(event) => setRole(event.target.value as AccountRole)}
								>
									{inviteableRoles(actor).map((item) => (
										<option key={item} value={item}>
											{ROLE_META[item].label}
										</option>
									))}
								</select>
								<p className="text-muted-foreground text-xs">
									{ROLE_META[role].description}
								</p>
								<Button
									variant="outline"
									size="sm"
									onClick={handleAssignRole}
									disabled={assignMutation.isPending}
								>
									Update role
								</Button>
							</div>
						) : null}

						{canManageAssignments(actor) &&
						(target.role === "admin" || target.role === "manager") ? (
							<div className="space-y-3 rounded-md border p-3">
								<div>
									<p className="text-sm font-medium">Role assignments</p>
									<p className="text-muted-foreground text-xs">
										Domains and shared mailboxes this {target.role} can manage.
									</p>
								</div>
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

								{target.role === "manager" ? (
									<>
										<label className="flex items-center gap-2 text-sm">
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
																	onChange={() =>
																		toggleSharedMailbox(mailbox.id!)
																	}
																/>
																{mailbox.address}
															</label>
														) : null,
													)
												)}
											</div>
										) : null}
									</>
								) : null}

								<Button
									variant="outline"
									size="sm"
									onClick={handleSaveAssignments}
									disabled={assignmentsMutation.isPending}
								>
									Save assignments
								</Button>
							</div>
						) : null}

						{canManageUserMailboxGrants(actor) && target.role === "user" ? (
							<div className="space-y-3 rounded-md border p-3">
								<div>
									<p className="text-sm font-medium">Shared mailbox access</p>
									<p className="text-muted-foreground text-xs">
										Shared mailboxes this user can read and send from.
									</p>
								</div>
								<div className="space-y-2">
									{grantableSharedMailboxes.length === 0 ? (
										<p className="text-muted-foreground text-sm">
											No shared mailboxes available.
										</p>
									) : (
										grantableSharedMailboxes.map((mailbox) =>
											mailbox.id ? (
												<label
													key={mailbox.id}
													className="flex items-center gap-2 text-sm"
												>
													<input
														type="checkbox"
														checked={grantedMailboxIds.includes(mailbox.id)}
														onChange={() => toggleGrantedMailbox(mailbox.id!)}
													/>
													{mailbox.address}
												</label>
											) : null,
										)
									)}
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={handleSaveUserGrants}
									disabled={assignmentsMutation.isPending}
								>
									Save mailbox access
								</Button>
							</div>
						) : null}

						<div className="flex flex-wrap gap-2">
							<Button onClick={handleSave} disabled={updateMutation.isPending}>
								Save profile
							</Button>
							{target.status === "pending" ? (
								<Button
									variant="outline"
									onClick={() =>
										regenerateInviteMutation.mutate(target.id, {
											onSuccess: (code) => setInviteCode(code),
											onError: (err) => setError(getErrorMessage(err)),
										})
									}
									disabled={regenerateInviteMutation.isPending}
								>
									Show invite code
								</Button>
							) : null}
							{canSuspendTarget(actor, target) && target.status !== "suspended" ? (
								<Button
									variant="outline"
									onClick={() =>
										suspendMutation.mutate(target.id, {
											onSuccess: onClose,
											onError: (err) => setError(getErrorMessage(err)),
										})
									}
								>
									Suspend
								</Button>
							) : null}
							{canSuspendTarget(actor, target) && target.status === "suspended" ? (
								<Button
									variant="outline"
									onClick={() =>
										unsuspendMutation.mutate(target.id, {
											onSuccess: onClose,
											onError: (err) => setError(getErrorMessage(err)),
										})
									}
								>
									Unsuspend
								</Button>
							) : null}
							<Button
								variant="outline"
								onClick={() =>
									resetCodeMutation.mutate(target.id, {
										onSuccess: (code) => setResetCode(code),
										onError: (err) => setError(getErrorMessage(err)),
									})
								}
							>
								Issue reset code
							</Button>
							{canRemoveTarget(actor, target) ? (
								<Button
									variant="destructive"
									onClick={() => setConfirmingRemove(true)}
									disabled={removeMutation.isPending}
								>
									Remove
								</Button>
							) : null}
						</div>

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
							<Alert tone="destructive">
								<p>{error}</p>
							</Alert>
						) : null}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
