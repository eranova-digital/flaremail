import { useEffect, useMemo, useState } from "react";
import { HelpCircle, Loader2 } from "lucide-react";

import { getAccountDisplayName } from "@/components/ProfileAvatar";
import { RecoveryEmailSetup } from "@/components/auth/RecoveryEmailSetup";
import { ProfileFieldsGrid } from "@/components/settings/ProfileFieldsGrid";
import { ProfilePictureControls } from "@/components/settings/ProfilePictureControls";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { accountQueryKeys } from "@/hooks/use-accounts";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getErrorMessage } from "@/lib/api/errors";
import { roleLabel } from "@/lib/accounts/roles";
import type { AccountRole } from "@/lib/accounts/api";
import { useQueryClient } from "@tanstack/react-query";

const LOCKED_FIELD_TOOLTIP =
	"This information has been locked by your organization.";

function LockedFieldHelp() {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					className="text-muted-foreground hover:text-foreground inline-flex shrink-0"
					aria-label={LOCKED_FIELD_TOOLTIP}
				>
					<HelpCircle className="size-3.5" aria-hidden />
				</button>
			</TooltipTrigger>
			<TooltipContent>{LOCKED_FIELD_TOOLTIP}</TooltipContent>
		</Tooltip>
	);
}

export function ProfileSection() {
	const { account, refresh } = useAuth();
	const queryClient = useQueryClient();
	const [values, setValues] = useState<Record<string, string>>({});
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);
	const hiddenFields = useMemo(
		() => new Set(["recoveryAddress" as const]),
		[],
	);

	useEffect(() => {
		if (!account?.profile) {
			return;
		}
		setValues({
			firstName: account.profile.firstName ?? "",
			lastName: account.profile.lastName ?? "",
			recoveryAddress: account.profile.recoveryAddress ?? "",
			phone: account.profile.phone ?? "",
			addressCountry: account.profile.address.country ?? "",
			addressState: account.profile.address.state ?? "",
			addressCity: account.profile.address.city ?? "",
			addressLine1: account.profile.address.line1 ?? "",
			addressLine2: account.profile.address.line2 ?? "",
		});
	}, [account]);

	if (!account) {
		return null;
	}

	if (account.isIntendant) {
		return null;
	}

	const locked = new Set(account.lockedFields ?? []);
	const recoveryLocked = locked.has("recoveryAddress");

	const handleSave = async () => {
		setSaving(true);
		setError(null);
		setSaved(false);
		try {
			const response = await fetch(apiUrl("/auth/me"), {
				method: "PATCH",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					profile: {
						firstName: values.firstName,
						lastName: values.lastName,
						phone: values.phone || null,
						address: {
							country: values.addressCountry || null,
							state: values.addressState || null,
							city: values.addressCity || null,
							line1: values.addressLine1 || null,
							line2: values.addressLine2 || null,
						},
					},
				}),
			});
			if (!response.ok) {
				const body = await response.json().catch(() => null);
				throw new Error(getErrorMessage(body) ?? "Save failed");
			}
			await refresh();
			setSaved(true);
		} catch (err) {
			setError(getErrorMessage(err));
		} finally {
			setSaving(false);
		}
	};

	const displayName = getAccountDisplayName(account);

	return (
		<section className="space-y-4">
			<ProfilePictureControls
				accountId={account.id}
				loginIdentifier={account.loginIdentifier}
				displayName={displayName}
				profilePicture={account.profilePicture ?? null}
				onUpdated={async () => {
					await refresh();
					await queryClient.invalidateQueries({ queryKey: accountQueryKeys.all });
				}}
				details={
					<>
						<h2 className="truncate text-lg font-medium">{displayName}</h2>
						<p className="text-muted-foreground truncate text-sm">
							{account.loginIdentifier}
							{" · "}
							{roleLabel(account.role as AccountRole | null, account.isIntendant)}
						</p>
					</>
				}
			/>
			<Card>
				<CardHeader>
					<CardTitle>Personal details</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<ProfileFieldsGrid
						idPrefix="profile"
						values={values}
						onChange={(key, value) => {
							setSaved(false);
							setValues((current) => ({ ...current, [key]: value }));
						}}
						isFieldDisabled={(key) => locked.has(key)}
						labelExtra={(key) => (locked.has(key) ? <LockedFieldHelp /> : null)}
						hiddenFields={hiddenFields}
					/>
					{error ? (
						<Alert tone="destructive" title="Couldn't save profile">
							<p>{error}</p>
						</Alert>
					) : null}
					{saved ? (
						<Alert tone="success">Profile saved.</Alert>
					) : null}
					<Button onClick={handleSave} disabled={saving}>
						{saving ? (
							<Loader2 className="size-4 animate-spin" aria-hidden />
						) : null}
						{saving ? "Saving…" : "Save profile"}
					</Button>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Recovery email</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					{recoveryLocked ? (
						<>
							<p className="text-muted-foreground text-sm">
								Your organization has set a recovery email for this account.
							</p>
							<Input
								value={account.profile?.recoveryAddress ?? ""}
								disabled
								readOnly
							/>
						</>
					) : account.profile?.recoveryAddress ? (
						<>
							<p className="text-muted-foreground text-sm">
								Current recovery email:{" "}
								<span className="text-foreground font-medium">
									{account.profile.recoveryAddress}
								</span>
							</p>
							<RecoveryEmailSetup
								showSkip={false}
								submitLabel="Update recovery email"
								onComplete={async () => {
									await refresh();
									setSaved(true);
								}}
							/>
						</>
					) : (
						<RecoveryEmailSetup
							showSkip={false}
							submitLabel="Add recovery email"
							onComplete={async () => {
								await refresh();
								setSaved(true);
							}}
						/>
					)}
				</CardContent>
			</Card>
		</section>
	);
}
