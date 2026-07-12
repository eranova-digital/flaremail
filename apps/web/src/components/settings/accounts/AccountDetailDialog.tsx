import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	useAccount,
	useAssignAccountRole,
	useCreatePasswordResetCode,
	useRegenerateInviteCode,
	useRemoveAccount,
	useSuspendAccount,
	useUnsuspendAccount,
	useUpdateAccount,
} from "@/hooks/use-accounts";
import { PROFILE_FIELDS, type AccountRole } from "@/lib/accounts/api";
import {
	canAssignRoles,
	canLockProfileFields,
	canRemoveTarget,
	canSuspendTarget,
	inviteableRoles,
} from "@/lib/accounts/permissions";
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
	const detailQuery = useAccount(accountId);
	const updateMutation = useUpdateAccount();
	const assignMutation = useAssignAccountRole();
	const suspendMutation = useSuspendAccount();
	const unsuspendMutation = useUnsuspendAccount();
	const removeMutation = useRemoveAccount();
	const resetCodeMutation = useCreatePasswordResetCode();
	const regenerateInviteMutation = useRegenerateInviteCode();

	const [role, setRole] = useState<AccountRole>("user");
	const [lockedFields, setLockedFields] = useState<Set<string>>(new Set());
	const [profileValues, setProfileValues] = useState<Record<string, string>>({});
	const [resetCode, setResetCode] = useState<string | null>(null);
	const [inviteCode, setInviteCode] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const target = detailQuery.data;

	useEffect(() => {
		if (!target?.profile) {
			return;
		}
		setProfileValues({
			firstName: target.profile.firstName,
			lastName: target.profile.lastName,
			recoveryAddress: target.profile.recoveryAddress ?? "",
			phone: target.profile.phone ?? "",
			addressCountry: target.profile.address.country ?? "",
			addressState: target.profile.address.state ?? "",
			addressCity: target.profile.address.city ?? "",
			addressLine1: target.profile.address.line1 ?? "",
			addressLine2: target.profile.address.line2 ?? "",
		});
		setLockedFields(new Set(target.lockedFields));
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

	const handleAssignRole = () => {
		if (!accountId || !target?.domainId) {
			return;
		}
		assignMutation.mutate(
			{
				accountId,
				role,
				domainIds:
					role === "admin" || role === "manager"
						? [target.domainId]
						: undefined,
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
				) : !target ? (
					<p className="text-destructive text-sm">Account not found.</p>
				) : (
					<div className="space-y-4">
						<div className="flex flex-wrap items-center gap-2 text-sm">
							<span>{target.loginIdentifier}</span>
							<Badge variant="secondary">
								{target.role ?? "intendant"} · {target.status}
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
											{canLockProfileFields(actor) ? (
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
											{item}
										</option>
									))}
								</select>
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
									onClick={() => {
										if (
											!window.confirm(
												`Permanently remove ${target.displayName}? This cannot be undone.`,
											)
										) {
											return;
										}
										removeMutation.mutate(target.id, {
											onSuccess: onClose,
											onError: (err) => setError(getErrorMessage(err)),
										});
									}}
								>
									Remove
								</Button>
							) : null}
						</div>

						{resetCode ? (
							<p className="text-sm">
								Password reset code: <strong>{resetCode}</strong>
							</p>
						) : null}
						{inviteCode ? (
							<div className="bg-muted rounded-md px-4 py-3 text-sm">
								<p className="font-medium">Invite code</p>
								<p>
									Code: <strong className="font-mono">{inviteCode}</strong>
								</p>
								<p className="text-muted-foreground mt-1 text-xs">
									Share this code with the user to complete activation. Previous
									unused codes were invalidated.
								</p>
							</div>
						) : null}
						{error ? <p className="text-destructive text-sm">{error}</p> : null}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
