import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AtSign, Loader2, Lock } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { RecoveryEmailSetup } from "@/components/auth/RecoveryEmailSetup";
import { AuthCodeInput, isAuthCodeComplete } from "@/components/auth/AuthCodeInput";
import { PageLoader } from "@/components/PageLoader";
import {
	ProfileFieldsGrid,
	type ProfileFieldKey,
} from "@/components/settings/ProfileFieldsGrid";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchInvitePreview } from "@/lib/accounts/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { Account } from "@/lib/auth/types";
import { getErrorMessage } from "@/lib/api/errors";
import { formatAuthCode } from "@/lib/format-auth-code";
import { isStrongPassword } from "@/lib/password-strength";
import { isValidPhoneNumber, normalizePhoneInput } from "@/lib/validate-phone";
import { setLastMailboxId } from "@/lib/mailbox-preference";

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

type ActivateStep = "code" | "profile" | "recovery";

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

function getPostActivatePath(account: Account): string {
	if (account.isIntendant) {
		return "/management";
	}
	if (account.primaryMailboxId) {
		return `/m/${account.primaryMailboxId}/inbox`;
	}
	return "/";
}

function shouldSkipRecoveryStep(
	account: Account,
	requireRecoveryEmail: boolean,
): boolean {
	if (requireRecoveryEmail) {
		const hasRecovery = Boolean(account.profile?.recoveryAddress?.trim());
		return hasRecovery;
	}
	const locked = account.lockedFields?.includes("recoveryAddress") ?? false;
	const hasRecovery = Boolean(account.profile?.recoveryAddress?.trim());
	return locked && hasRecovery;
}

function finishActivation(
	account: Account,
	navigate: ReturnType<typeof useNavigate>,
) {
	if (account.primaryMailboxId) {
		setLastMailboxId(account.primaryMailboxId);
	}
	navigate(getPostActivatePath(account), { replace: true });
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

export function ActivatePage() {
	const { t } = useTranslation("auth");
	const { isAuthenticated, isLoading, account, activate, refresh } = useAuth();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	const initialCode = formatAuthCode(searchParams.get("code") ?? "");
	const [step, setStep] = useState<ActivateStep>("code");
	const [code, setCode] = useState(initialCode);
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [profile, setProfile] = useState<ProfileFormState>(emptyProfile);
	const [lockedFields, setLockedFields] = useState<Set<string>>(new Set());
	const [inviteAddress, setInviteAddress] = useState<string | null>(null);
	const [previewLoading, setPreviewLoading] = useState(false);
	const [previewError, setPreviewError] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [activatedAccount, setActivatedAccount] = useState<Account | null>(null);
	const [requireRecoveryEmail, setRequireRecoveryEmail] = useState(false);

	const hiddenProfileFields = useMemo(
		() => new Set<ProfileFieldKey>(["recoveryAddress"]),
		[],
	);

	const lockedFieldSet = useMemo(() => lockedFields, [lockedFields]);
	const requiredFields = useMemo(
		() => new Set([...lockedFields].filter((field) => field !== "recoveryAddress")),
		[lockedFields],
	);

	useEffect(() => {
		if (step !== "code") {
			return;
		}

		const trimmed = code.trim();
		if (!trimmed) {
			setInviteAddress(null);
			setLockedFields(new Set());
			setProfile(emptyProfile());
			setRequireRecoveryEmail(false);
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
				setRequireRecoveryEmail(preview.requireRecoveryEmail);
				setProfile(profileFromPreview(preview));
			} catch (fetchError) {
				setInviteAddress(null);
				setLockedFields(new Set());
				setRequireRecoveryEmail(false);
				setProfile(emptyProfile());
				setPreviewError(getErrorMessage(fetchError));
			} finally {
				setPreviewLoading(false);
			}
		}, 350);

		return () => window.clearTimeout(timer);
	}, [code, step]);

	useEffect(() => {
		if (!initialCode || step !== "code") {
			return;
		}

		let cancelled = false;

		(async () => {
			setPreviewLoading(true);
			setPreviewError(null);
			try {
				const preview = await fetchInvitePreview(initialCode);
				if (cancelled) {
					return;
				}
				setInviteAddress(preview.address);
				setLockedFields(new Set(preview.lockedFields));
				setRequireRecoveryEmail(preview.requireRecoveryEmail);
				setProfile(profileFromPreview(preview));
				setStep("profile");
			} catch {
				// Stay on code step; debounced preview handles inline errors.
			} finally {
				if (!cancelled) {
					setPreviewLoading(false);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [initialCode, step]);

	if (isLoading) {
		return <PageLoader label={t("session.checking")} />;
	}

	if (isAuthenticated && account && step !== "recovery") {
		return <Navigate to={getPostActivatePath(account)} replace />;
	}

	const codeComplete = isAuthCodeComplete(code);
	const canContinueToProfile =
		codeComplete && inviteAddress !== null && !previewLoading && !previewError;

	const handleContinue = () => {
		if (!canContinueToProfile) {
			return;
		}
		setError(null);
		setStep("profile");
	};

	const handleBackToCode = () => {
		setStep("code");
		setError(null);
	};

	const passwordsMatch = password === confirmPassword;
	const passwordStrong = isStrongPassword(password);
	const canSubmitProfile =
		Boolean(password) &&
		Boolean(confirmPassword) &&
		passwordsMatch &&
		passwordStrong;

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError(null);

		if (!passwordsMatch) {
			setError(t("passwordsDoNotMatch"));
			return;
		}
		if (!passwordStrong) {
			setError(t("passwordTooWeak"));
			return;
		}

		const phone = normalizePhoneInput(profile.phone);
		if (phone && !isValidPhoneNumber(phone)) {
			setError(t("invalidPhone", { defaultValue: "Enter a valid phone number in international format (e.g. +14155552671)." }));
			return;
		}

		setSubmitting(true);

		try {
			const me = await activate({
				code: code.trim(),
				password,
				profile: {
					firstName: profile.firstName.trim() || undefined,
					lastName: profile.lastName.trim() || undefined,
					phone,
					addressCountry: profile.addressCountry.trim() || null,
					addressState: profile.addressState.trim() || null,
					addressCity: profile.addressCity.trim() || null,
					addressLine1: profile.addressLine1.trim() || null,
					addressLine2: profile.addressLine2.trim() || null,
				},
			});
			if (shouldSkipRecoveryStep(me, requireRecoveryEmail)) {
				finishActivation(me, navigate);
				return;
			}
			setActivatedAccount(me);
			setStep("recovery");
		} catch (submitError) {
			setError(getErrorMessage(submitError));
		} finally {
			setSubmitting(false);
		}
	};

	const description =
		step === "code"
			? t("activate.descriptionCode")
			: step === "profile"
				? t("activate.descriptionProfile")
				: t("activate.descriptionRecovery");

	return (
		<AuthPageShell title={t("activate.title")} description={description}>
			<Card className="rounded-xl py-6 shadow-sm">
				<CardContent>
					{step === "code" ? (
						<form
							onSubmit={(event) => {
								event.preventDefault();
								handleContinue();
							}}
							className="space-y-4"
						>
							<div className="space-y-2">
								<label htmlFor="code" className="text-sm font-medium">
									{t("activate.inviteCode")}
								</label>
								<AuthCodeInput
									id="code"
									value={code}
									onChange={setCode}
									disabled={submitting}
									autoFocus={!code}
									invalid={Boolean(previewError && codeComplete)}
								/>
								{!codeComplete && !previewError ? (
									<p className="text-muted-foreground text-xs">
										<Trans
											i18nKey="activate.codeHint"
											ns="auth"
											components={{
												example: <span className="font-mono" />,
											}}
										/>
									</p>
								) : null}
							</div>

							{previewLoading ? (
								<div className="bg-muted flex items-center gap-3 rounded-lg px-4 py-3 text-sm">
									<Loader2 className="text-muted-foreground size-4 shrink-0 animate-spin" />
									<p className="text-muted-foreground">
										{t("activate.checkingInvite")}
									</p>
								</div>
							) : previewError && codeComplete ? (
								<Alert tone="destructive">{previewError}</Alert>
							) : null}

							<Button
								type="submit"
								className="w-full"
								disabled={!canContinueToProfile || submitting}
							>
								{t("activate.continue")}
							</Button>
						</form>
					) : step === "profile" ? (
						<form onSubmit={handleSubmit} className="space-y-4">
							<div className="bg-muted flex items-center gap-3 rounded-lg px-4 py-3 text-sm">
								<AtSign className="text-muted-foreground size-4 shrink-0" />
								<div>
									<p className="text-muted-foreground text-xs">
										{t("activate.yourMailbox")}
									</p>
									<p className="font-medium">{inviteAddress}</p>
								</div>
							</div>

							<div className="space-y-3">
								<div>
									<p className="text-sm font-medium">{t("activate.yourProfile")}</p>
									<p className="text-muted-foreground text-xs">
										{t("activate.profileHint")}
									</p>
								</div>
								<ProfileFieldsGrid
									idPrefix="activate"
									values={profile}
									onChange={(key: ProfileFieldKey, value: string) =>
										setProfile((current) => ({ ...current, [key]: value }))
									}
									disabled={submitting}
									isFieldDisabled={(key) => lockedFieldSet.has(key)}
									requiredFields={requiredFields}
									hiddenFields={hiddenProfileFields}
									labelExtra={(key) =>
										lockedFieldSet.has(key) ? (
											<Lock
												className="text-muted-foreground size-3"
												aria-label={t("activate.lockedByAdmin")}
											/>
										) : null
									}
								/>
							</div>

							<div className="space-y-2">
								<label htmlFor="password" className="text-sm font-medium">
									{t("activate.choosePassword")}
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
									{t("activate.passwordHint")}
								</p>
							</div>

							<div className="space-y-2">
								<label htmlFor="confirm-password" className="text-sm font-medium">
									{t("activate.confirmPassword")}
								</label>
								<PasswordInput
									id="confirm-password"
									autoComplete="new-password"
									value={confirmPassword}
									onChange={(event) => setConfirmPassword(event.target.value)}
									disabled={submitting}
									required
									aria-invalid={
										Boolean(confirmPassword) && !passwordsMatch
									}
								/>
								{confirmPassword && !passwordsMatch ? (
									<p className="text-destructive text-xs">
										{t("passwordsDoNotMatch")}
									</p>
								) : null}
							</div>

							{error ? <Alert tone="destructive">{error}</Alert> : null}

							<Button
								type="submit"
								className="w-full"
								disabled={submitting || !canSubmitProfile}
							>
								{submitting ? (
									<Loader2 className="size-4 animate-spin" aria-hidden />
								) : null}
								{submitting
									? t("activate.activating")
									: t("activate.activateAccount")}
							</Button>
							<Button
								type="button"
								variant="ghost"
								className="w-full"
								onClick={handleBackToCode}
								disabled={submitting}
							>
								{t("activate.back")}
							</Button>
						</form>
					) : (
						<RecoveryEmailSetup
							initialEmail={activatedAccount?.profile?.recoveryAddress ?? ""}
							showSkip={!requireRecoveryEmail}
							onComplete={async () => {
								await refresh();
								if (activatedAccount) {
									finishActivation(activatedAccount, navigate);
								}
							}}
							onSkip={() => {
								if (activatedAccount) {
									finishActivation(activatedAccount, navigate);
								}
							}}
						/>
					)}
				</CardContent>
			</Card>
			<p className="text-muted-foreground text-center text-sm">
				{t("activate.alreadyActivated")}{" "}
				<Link to="/login" className="text-primary font-medium hover:underline">
					{t("activate.signIn")}
				</Link>
			</p>
		</AuthPageShell>
	);
}
