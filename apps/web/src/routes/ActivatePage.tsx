import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AtSign, Loader2, Lock } from "lucide-react";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PageLoader } from "@/components/PageLoader";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PROFILE_FIELDS, fetchInvitePreview } from "@/lib/accounts/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getErrorMessage } from "@/lib/api/errors";
import { formatAuthCode } from "@/lib/format-auth-code";

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

function getPostActivatePath(account: { isIntendant: boolean }): string {
	return account.isIntendant ? "/settings" : "/";
}

function profileFromPreview(
	preview: Awaited<ReturnType<typeof fetchInvitePreview>> | null,
): ProfileFormState {
	if (!preview?.profile) {
		return emptyProfile();
	}
	return {
		firstName: preview.profile.firstName ?? "",
		lastName: preview.profile.lastName ?? "",
		recoveryAddress: preview.profile.recoveryAddress ?? "",
		phone: preview.profile.phone ?? "",
		addressCountry: preview.profile.address.country ?? "",
		addressState: preview.profile.address.state ?? "",
		addressCity: preview.profile.address.city ?? "",
		addressLine1: preview.profile.address.line1 ?? "",
		addressLine2: preview.profile.address.line2 ?? "",
	};
}

function isFieldVisible(
	fieldKey: string,
	profile: ProfileFormState,
	lockedFields: Set<string>,
): boolean {
	if (lockedFields.has(fieldKey)) {
		return true;
	}
	const value = profile[fieldKey as keyof ProfileFormState];
	return typeof value === "string" && value.trim().length > 0;
}

export function ActivatePage() {
	const { isAuthenticated, isLoading, account, activate } = useAuth();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	const [code, setCode] = useState(() =>
		formatAuthCode(searchParams.get("code") ?? ""),
	);
	const [password, setPassword] = useState("");
	const [profile, setProfile] = useState<ProfileFormState>(emptyProfile);
	const [lockedFields, setLockedFields] = useState<Set<string>>(new Set());
	const [inviteAddress, setInviteAddress] = useState<string | null>(null);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [previewError, setPreviewError] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		const trimmed = code.trim();
		if (!trimmed) {
			setInviteAddress(null);
			setLockedFields(new Set());
			setProfile(emptyProfile());
			setPreviewError(null);
			return;
		}

		const timer = window.setTimeout(async () => {
			setPreviewLoading(true);
			setPreviewError(null);
			setError(null);
			try {
				const preview = await fetchInvitePreview(trimmed);
				setInviteAddress(preview.address);
				setLockedFields(new Set(preview.lockedFields));
				setProfile(profileFromPreview(preview));
			} catch (fetchError) {
				setInviteAddress(null);
				setLockedFields(new Set());
				setProfile(emptyProfile());
				setPreviewError(getErrorMessage(fetchError));
			} finally {
				setPreviewLoading(false);
			}
		}, 350);

		return () => window.clearTimeout(timer);
	}, [code]);

	const visibleFields = useMemo(
		() =>
			PROFILE_FIELDS.filter((field) =>
				isFieldVisible(field.key, profile, lockedFields),
			),
		[lockedFields, profile],
	);

	if (isLoading) {
		return <PageLoader label="Checking your session…" />;
	}

	if (isAuthenticated && account) {
		return <Navigate to={getPostActivatePath(account)} replace />;
	}

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError(null);
		setSubmitting(true);

		try {
			const me = await activate({
				code: code.trim(),
				password,
				profile: {
					firstName: profile.firstName.trim() || undefined,
					lastName: profile.lastName.trim() || undefined,
					recoveryAddress: profile.recoveryAddress.trim() || null,
					phone: profile.phone.trim() || null,
					addressCountry: profile.addressCountry.trim() || null,
					addressState: profile.addressState.trim() || null,
					addressCity: profile.addressCity.trim() || null,
					addressLine1: profile.addressLine1.trim() || null,
					addressLine2: profile.addressLine2.trim() || null,
				},
			});
			navigate(getPostActivatePath(me), { replace: true });
		} catch (submitError) {
			setError(getErrorMessage(submitError));
		} finally {
			setSubmitting(false);
		}
	};

	const codeComplete = code.trim().length >= 9;

	return (
		<AuthPageShell
			title="Activate your account"
			description="Enter your invite code, confirm your details, and choose a password."
		>
			<Card className="rounded-xl py-6 shadow-sm">
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<label htmlFor="code" className="text-sm font-medium">
								Invite code
							</label>
							<Input
								id="code"
								autoComplete="one-time-code"
								autoFocus={!code}
								placeholder="XXXX-XXXX"
								className="font-mono tracking-wider uppercase"
								value={code}
								onChange={(event) => setCode(formatAuthCode(event.target.value))}
								disabled={submitting}
								required
							/>
							{!codeComplete && !previewError ? (
								<p className="text-muted-foreground text-xs">
									You'll find this in your invitation. Codes look like{" "}
									<span className="font-mono">AB2C-D4EF</span>.
								</p>
							) : null}
						</div>

						{previewLoading ? (
							<div className="bg-muted flex items-center gap-3 rounded-lg px-4 py-3">
								<AtSign className="text-muted-foreground size-4 shrink-0" />
								<div className="flex-1 space-y-1.5">
									<Skeleton className="h-3 w-20" />
									<Skeleton className="h-4 w-40" />
								</div>
							</div>
						) : inviteAddress ? (
							<div className="bg-muted flex items-center gap-3 rounded-lg px-4 py-3 text-sm">
								<AtSign className="text-muted-foreground size-4 shrink-0" />
								<div>
									<p className="text-muted-foreground text-xs">
										Your new mailbox
									</p>
									<p className="font-medium">{inviteAddress}</p>
								</div>
							</div>
						) : previewError && codeComplete ? (
							<Alert tone="destructive">{previewError}</Alert>
						) : null}

						{visibleFields.length > 0 ? (
							<div className="space-y-3">
								<div>
									<p className="text-sm font-medium">Your details</p>
									<p className="text-muted-foreground text-xs">
										Pre-filled by your administrator. Locked fields can't be
										changed here.
									</p>
								</div>
								<div className="grid gap-4 sm:grid-cols-2">
									{visibleFields.map((field) => {
										const isLocked = lockedFields.has(field.key);
										return (
											<div
												key={field.key}
												className={
													field.key.startsWith("address") ? "sm:col-span-2" : ""
												}
											>
												<label
													htmlFor={field.key}
													className="mb-1 flex items-center gap-1.5 text-sm font-medium"
												>
													{field.label}
													{isLocked ? (
														<Lock
															className="text-muted-foreground size-3"
															aria-label="Locked by your administrator"
														/>
													) : null}
												</label>
												<Input
													id={field.key}
													value={profile[field.key as keyof ProfileFormState]}
													onChange={(event) =>
														setProfile((current) => ({
															...current,
															[field.key]: event.target.value,
														}))
													}
													disabled={submitting || isLocked}
													required={isLocked}
												/>
											</div>
										);
									})}
								</div>
							</div>
						) : null}

						<div className="space-y-2">
							<label htmlFor="password" className="text-sm font-medium">
								Choose a password
							</label>
							<PasswordInput
								id="password"
								autoComplete="new-password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								disabled={submitting}
								required
							/>
							<p className="text-muted-foreground text-xs">
								Use a long, unique password you don't use anywhere else.
							</p>
						</div>
						{error ? <Alert tone="destructive">{error}</Alert> : null}
						<Button
							type="submit"
							className="w-full"
							disabled={submitting || !code.trim() || !password}
						>
							{submitting ? (
								<Loader2 className="size-4 animate-spin" aria-hidden />
							) : null}
							{submitting ? "Activating…" : "Activate account"}
						</Button>
					</form>
				</CardContent>
			</Card>
			<p className="text-muted-foreground text-center text-sm">
				Already activated?{" "}
				<Link to="/login" className="text-primary font-medium hover:underline">
					Sign in
				</Link>
			</p>
		</AuthPageShell>
	);
}
