import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PROFILE_FIELDS } from "@/lib/accounts/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { apiUrl } from "@/lib/api";
import { getErrorMessage } from "@/lib/api/errors";

export function ProfileSection() {
	const { account, refresh } = useAuth();
	const [values, setValues] = useState<Record<string, string>>({});
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [saved, setSaved] = useState(false);

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
						recoveryAddress: values.recoveryAddress || null,
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

	return (
		<section className="space-y-4">
			<div>
				<h2 className="text-lg font-medium">Your profile</h2>
				<p className="text-muted-foreground text-sm">
					{account.loginIdentifier}
					{account.role ? ` · ${account.role}` : account.isIntendant ? " · intendant" : ""}
				</p>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>Profile fields</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					{PROFILE_FIELDS.map((field) => {
						const isLocked = locked.has(field.key);
						const inputId = `profile-${field.key}`;
						return (
							<div key={field.key} className="space-y-1">
								<label htmlFor={inputId} className="text-sm font-medium">
									{field.label}
									{isLocked ? (
										<span className="text-muted-foreground ml-2 text-xs">
											(locked)
										</span>
									) : null}
								</label>
								<Input
									id={inputId}
									value={values[field.key] ?? ""}
									disabled={isLocked}
									onChange={(event) =>
										setValues((current) => ({
											...current,
											[field.key]: event.target.value,
										}))
									}
								/>
							</div>
						);
					})}
					{error ? <p className="text-destructive text-sm">{error}</p> : null}
					{saved ? (
						<p className="text-muted-foreground text-sm">Profile saved.</p>
					) : null}
					<Button onClick={handleSave} disabled={saving}>
						Save profile
					</Button>
				</CardContent>
			</Card>
		</section>
	);
}
