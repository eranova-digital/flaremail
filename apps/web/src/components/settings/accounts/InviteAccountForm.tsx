import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDomains } from "@/hooks/use-domains";
import {
	useInviteAccount,
	useLocalPartPolicy,
	useSuggestInviteLocalPart,
} from "@/hooks/use-accounts";
import { PROFILE_FIELDS, type AccountRole } from "@/lib/accounts/api";
import {
	canLockProfileFields,
	inviteableRoles,
} from "@/lib/accounts/permissions";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getErrorMessage } from "@/lib/api/errors";

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

export function InviteAccountForm() {
	const { account } = useAuth();
	const domainsQuery = useDomains();
	const inviteMutation = useInviteAccount();
	const suggestMutation = useSuggestInviteLocalPart();
	const roles = inviteableRoles(account);

	const [domainId, setDomainId] = useState("");
	const [role, setRole] = useState<AccountRole>("user");
	const [localPart, setLocalPart] = useState("");
	const [profile, setProfile] = useState<ProfileFormState>(emptyProfile);
	const [lockedFields, setLockedFields] = useState<Set<string>>(new Set());
	const [sendInviteEmail, setSendInviteEmail] = useState(false);
	const [inviteCode, setInviteCode] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const policyQuery = useLocalPartPolicy(domainId || null);
	const canLock = canLockProfileFields(account);

	const availableDomains = useMemo(() => {
		const domains = domainsQuery.data ?? [];
		if (account?.isIntendant || account?.role === "superadmin") {
			return domains;
		}
		return domains;
	}, [account, domainsQuery.data]);

	useEffect(() => {
		if (!domainId || !profile.firstName.trim()) {
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
	}, [domainId, profile.firstName, profile.lastName, suggestMutation]);

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
			},
			{
				onSuccess: (data) => {
					setInviteCode(data.inviteCode);
					setProfile(emptyProfile());
					setLocalPart("");
					setLockedFields(new Set());
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
					<select
						className={selectClassName}
						value={domainId}
						onChange={(event) => setDomainId(event.target.value)}
					>
						<option value="">Select domain</option>
						{availableDomains.map((domain) => (
							<option key={domain.id} value={domain.id}>
								{domain.domain}
							</option>
						))}
					</select>
					{roles.length > 1 ? (
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
					) : null}
				</div>

				{policyQuery.data?.enforced && policyQuery.data.pattern ? (
					<p className="text-muted-foreground text-xs">
						Local part policy enforced: {policyQuery.data.pattern}
					</p>
				) : null}

				<Input
					placeholder="Local part (e.g. patrick)"
					value={localPart}
					onChange={(event) => setLocalPart(event.target.value)}
				/>

				<div className="space-y-3">
					{PROFILE_FIELDS.map((field) => (
						<div key={field.key} className="space-y-1">
							<div className="flex items-center justify-between gap-2">
								<label className="text-sm font-medium">{field.label}</label>
								{canLock ? (
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
								value={profile[field.key as keyof ProfileFormState]}
								onChange={(event) =>
									setProfile((current) => ({
										...current,
										[field.key]: event.target.value,
									}))
								}
							/>
						</div>
					))}
				</div>

				<label className="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						checked={sendInviteEmail}
						onChange={(event) => setSendInviteEmail(event.target.checked)}
					/>
					Send invite code to recovery address (logs only for now)
				</label>

				{error ? <p className="text-destructive text-sm">{error}</p> : null}
				{inviteCode ? (
					<p className="text-sm">
						Invite code: <strong>{inviteCode}</strong>
					</p>
				) : null}

				<Button
					onClick={handleInvite}
					disabled={!domainId || !localPart || inviteMutation.isPending}
				>
					Create invite
				</Button>
			</CardContent>
		</Card>
	);
}
