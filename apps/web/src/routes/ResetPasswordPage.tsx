import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AtSign, ChevronRight, KeyRound, Loader2, Mail } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";

import {
	AuthPageShell,
	authStickyActionClassName,
} from "@/components/auth/AuthPageShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrengthHints } from "@/components/auth/PasswordStrengthHints";
import { AuthCodeInput, isAuthCodeComplete } from "@/components/auth/AuthCodeInput";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/AuthProvider";
import { requestPasswordReset, fetchPasswordResetPreview } from "@/lib/auth/api";
import {
	getErrorMessage,
	isNoRecoveryEmailError,
} from "@/lib/api/errors";
import { formatAuthCode } from "@/lib/format-auth-code";
import { isStrongPassword } from "@/lib/password-strength";

type ResetStep = "choose" | "email" | "no-recovery" | "code" | "password";

export function ResetPasswordPage() {
	const { t } = useTranslation("auth");
	const { resetPassword } = useAuth();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	const initialCode = formatAuthCode(searchParams.get("code") ?? "");
	const [step, setStep] = useState<ResetStep>(
		initialCode ? "code" : "choose",
	);
	const [address, setAddress] = useState("");
	const [accountAddress, setAccountAddress] = useState<string | null>(null);
	const [code, setCode] = useState(initialCode);
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [info, setInfo] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const resetMessages = () => {
		setError(null);
		setInfo(null);
	};

	const handleRequestReset = async (event: React.FormEvent) => {
		event.preventDefault();
		resetMessages();
		setSubmitting(true);

		try {
			await requestPasswordReset(address.trim());
			setInfo(t("resetPassword.code.sentInfo"));
			setStep("code");
		} catch (submitError) {
			if (isNoRecoveryEmailError(submitError)) {
				setStep("no-recovery");
				return;
			}
			setError(getErrorMessage(submitError));
		} finally {
			setSubmitting(false);
		}
	};

	const passwordsMatch = password === confirmPassword;
	const passwordStrong = isStrongPassword(password);
	const canSubmitPassword =
		Boolean(password) &&
		Boolean(confirmPassword) &&
		passwordsMatch &&
		passwordStrong;

	const handleContinueFromCode = async (event: React.FormEvent) => {
		event.preventDefault();
		resetMessages();
		setSubmitting(true);

		try {
			const preview = await fetchPasswordResetPreview(code);
			setAccountAddress(preview.address);
			setStep("password");
		} catch (submitError) {
			setError(getErrorMessage(submitError));
		} finally {
			setSubmitting(false);
		}
	};

	const handleResetSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		resetMessages();

		if (!passwordsMatch) {
			setError(t("passwordsDoNotMatch"));
			return;
		}
		if (!passwordStrong) {
			setError(t("passwordTooWeak"));
			return;
		}

		setSubmitting(true);

		try {
			await resetPassword({ code: code.trim(), password });
			navigate("/login", {
				replace: true,
				state: { success: t("resetPassword.success") },
			});
		} catch (submitError) {
			setError(getErrorMessage(submitError));
		} finally {
			setSubmitting(false);
		}
	};

	const title =
		step === "choose"
			? t("resetPassword.choose.title")
			: step === "email"
				? t("resetPassword.email.title")
				: step === "no-recovery"
					? t("resetPassword.noRecovery.title")
					: step === "code"
						? t("resetPassword.code.title")
						: t("resetPassword.password.title");

	const description =
		step === "choose"
			? t("resetPassword.choose.description")
			: step === "email"
				? t("resetPassword.email.description")
				: step === "no-recovery"
					? t("resetPassword.noRecovery.description")
					: step === "code"
						? t("resetPassword.code.description")
						: t("resetPassword.password.description");

	return (
		<AuthPageShell title={title} description={description}>
			<Card className="rounded-xl py-6 shadow-sm">
				<CardContent>
					{step === "choose" ? (
						<div className="space-y-3">
							<Button
								type="button"
								variant="outline"
								className="hover:bg-accent h-auto w-full cursor-pointer justify-start gap-3 px-4 py-4"
								onClick={() => {
									resetMessages();
									setStep("email");
								}}
							>
								<Mail className="text-muted-foreground size-5 shrink-0" />
								<span className="min-w-0 flex-1 text-left">
									<span className="block text-sm font-medium">
										{t("resetPassword.choose.emailTitle")}
									</span>
									<span className="text-muted-foreground block text-xs">
										{t("resetPassword.choose.emailDescription")}
									</span>
								</span>
								<ChevronRight className="text-muted-foreground size-4 shrink-0" />
							</Button>
							<Button
								type="button"
								variant="outline"
								className="hover:bg-accent h-auto w-full cursor-pointer justify-start gap-3 px-4 py-4"
								onClick={() => {
									resetMessages();
									setStep("code");
								}}
							>
								<KeyRound className="text-muted-foreground size-5 shrink-0" />
								<span className="min-w-0 flex-1 text-left">
									<span className="block text-sm font-medium">
										{t("resetPassword.choose.codeTitle")}
									</span>
									<span className="text-muted-foreground block text-xs">
										{t("resetPassword.choose.codeDescription")}
									</span>
								</span>
								<ChevronRight className="text-muted-foreground size-4 shrink-0" />
							</Button>
						</div>
					) : null}

					{step === "email" ? (
						<form onSubmit={handleRequestReset} className="space-y-4">
							<div className="space-y-2">
								<label htmlFor="address" className="text-sm font-medium">
									{t("resetPassword.email.addressLabel")}
								</label>
								<Input
									id="address"
									type="email"
									autoComplete="email"
									autoFocus
									placeholder={t("resetPassword.email.placeholder")}
									value={address}
									onChange={(event) => setAddress(event.target.value)}
									disabled={submitting}
									required
								/>
								<p className="text-muted-foreground text-xs">
									{t("resetPassword.choose.emailDescription")}
								</p>
							</div>
							{error ? <Alert tone="destructive">{error}</Alert> : null}
							<Button
								type="submit"
								className="w-full"
								disabled={submitting || !address.trim()}
							>
								{submitting ? (
									<Loader2 className="size-4 animate-spin" aria-hidden />
								) : null}
								{submitting
									? t("resetPassword.email.sending")
									: t("resetPassword.email.sendCode")}
							</Button>
							<Button
								type="button"
								variant="ghost"
								className="w-full"
								onClick={() => {
									resetMessages();
									setStep("choose");
								}}
								disabled={submitting}
							>
								{t("resetPassword.back")}
							</Button>
						</form>
					) : null}

					{step === "no-recovery" ? (
						<div className="space-y-4">
							<Alert tone="destructive">
								{t("resetPassword.noRecovery.message")}
							</Alert>
							<Button
								type="button"
								className="w-full"
								onClick={() => {
									resetMessages();
									setStep("code");
								}}
							>
								{t("resetPassword.noRecovery.haveCode")}
							</Button>
							<Button
								type="button"
								variant="ghost"
								className="w-full"
								onClick={() => {
									resetMessages();
									setStep("choose");
								}}
							>
								{t("resetPassword.back")}
							</Button>
						</div>
					) : null}

					{step === "code" ? (
						<form onSubmit={handleContinueFromCode} className="space-y-4">
							{info ? <Alert tone="success">{info}</Alert> : null}
							<div className="space-y-2">
								<label htmlFor="code" className="text-sm font-medium">
									{t("resetPassword.code.label")}
								</label>
								<AuthCodeInput
									id="code"
									value={code}
									onChange={setCode}
									disabled={submitting}
									autoFocus={!code}
									invalid={Boolean(error)}
								/>
								<p className="text-muted-foreground text-xs">
									<Trans
										i18nKey="resetPassword.code.hint"
										ns="auth"
										components={{
											example: <span className="font-mono" />,
										}}
									/>
								</p>
							</div>
							{error ? <Alert tone="destructive">{error}</Alert> : null}
							<div className={authStickyActionClassName}>
								<Button
									type="submit"
									className="w-full"
									disabled={submitting || !isAuthCodeComplete(code)}
								>
									{submitting ? (
										<Loader2 className="size-4 animate-spin" aria-hidden />
									) : null}
									{submitting
										? t("resetPassword.code.checking")
										: t("resetPassword.code.continue")}
								</Button>
							</div>
							<Button
								type="button"
								variant="ghost"
								className="w-full"
								onClick={() => {
									resetMessages();
									setStep("choose");
								}}
								disabled={submitting}
							>
								{t("resetPassword.back")}
							</Button>
						</form>
					) : null}

					{step === "password" ? (
						<form onSubmit={handleResetSubmit} className="space-y-4">
							{accountAddress ? (
								<div className="bg-muted flex items-center gap-3 rounded-lg px-4 py-3 text-sm">
									<AtSign className="text-muted-foreground size-4 shrink-0" />
									<div>
										<p className="text-muted-foreground text-xs">
											{t("resetPassword.password.yourMailbox")}
										</p>
										<p className="font-medium">{accountAddress}</p>
									</div>
								</div>
							) : null}
							<div className="space-y-2">
								<label htmlFor="password" className="text-sm font-medium">
									{t("resetPassword.password.newPassword")}
								</label>
								<PasswordInput
									id="password"
									autoComplete="new-password"
									value={password}
									onChange={(event) => setPassword(event.target.value)}
									disabled={submitting}
									autoFocus
									required
									aria-invalid={Boolean(password) && !passwordStrong}
								/>
								<PasswordStrengthHints password={password} />
							</div>
							<div className="space-y-2">
								<label htmlFor="confirm-password" className="text-sm font-medium">
									{t("resetPassword.password.confirmPassword")}
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
								disabled={submitting || !canSubmitPassword}
							>
								{submitting ? (
									<Loader2 className="size-4 animate-spin" aria-hidden />
								) : null}
								{submitting
									? t("resetPassword.password.resetting")
									: t("resetPassword.password.reset")}
							</Button>
							<Button
								type="button"
								variant="ghost"
								className="w-full"
								onClick={() => {
									resetMessages();
									setAccountAddress(null);
									setStep("code");
								}}
								disabled={submitting}
							>
								{t("resetPassword.back")}
							</Button>
						</form>
					) : null}
				</CardContent>
			</Card>
			<p className="text-muted-foreground text-center text-sm">
				{t("resetPassword.remembered")}{" "}
				<Link to="/login" className="text-primary font-medium hover:underline">
					{t("resetPassword.backToSignIn")}
				</Link>
			</p>
		</AuthPageShell>
	);
}
