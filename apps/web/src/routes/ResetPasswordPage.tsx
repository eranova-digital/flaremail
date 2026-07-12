import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, Loader2, Mail, AtSign } from "lucide-react";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { AuthCodeInput } from "@/components/auth/AuthCodeInput";
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

type ResetStep = "choose" | "email" | "no-recovery" | "code" | "password";

const NO_RECOVERY_MESSAGE =
	"You haven't configured a recovery email. Please ask a supervisor for a recovery code.";

export function ResetPasswordPage() {
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
			setInfo(
				"We sent a reset code to your recovery email. Enter it below to continue.",
			);
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
	const canSubmitPassword =
		Boolean(password) && Boolean(confirmPassword) && passwordsMatch;

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
			setError("Passwords do not match.");
			return;
		}

		setSubmitting(true);

		try {
			await resetPassword({ code: code.trim(), password });
			navigate("/login", {
				replace: true,
				state: { success: "Password reset. Sign in with your new password." },
			});
		} catch (submitError) {
			setError(getErrorMessage(submitError));
		} finally {
			setSubmitting(false);
		}
	};

	const title =
		step === "choose"
			? "Forgot password"
			: step === "email"
				? "Reset with email"
				: step === "no-recovery"
					? "Recovery email required"
					: step === "code"
						? "Enter reset code"
						: "Choose new password";

	const description =
		step === "choose"
			? "Choose how you'd like to reset your password."
			: step === "email"
				? "Enter your primary mailbox address."
				: step === "no-recovery"
					? "Self-service email reset isn't available for this account."
					: step === "code"
						? "Enter the reset code you received."
						: "Choose a new password for your account.";

	return (
		<AuthPageShell title={title} description={description}>
			<Card className="rounded-xl py-6 shadow-sm">
				<CardContent>
					{step === "choose" ? (
						<div className="space-y-3">
							<Button
								type="button"
								variant="outline"
								className="h-auto w-full justify-start gap-3 px-4 py-4"
								onClick={() => {
									resetMessages();
									setStep("email");
								}}
							>
								<Mail className="text-muted-foreground size-5 shrink-0" />
								<span className="text-left">
									<span className="block text-sm font-medium">Enter email</span>
									<span className="text-muted-foreground block text-xs">
										Send a reset code to your recovery email
									</span>
								</span>
							</Button>
							<Button
								type="button"
								variant="outline"
								className="h-auto w-full justify-start gap-3 px-4 py-4"
								onClick={() => {
									resetMessages();
									setStep("code");
								}}
							>
								<KeyRound className="text-muted-foreground size-5 shrink-0" />
								<span className="text-left">
									<span className="block text-sm font-medium">Enter code</span>
									<span className="text-muted-foreground block text-xs">
										Use a reset code from your supervisor
									</span>
								</span>
							</Button>
						</div>
					) : null}

					{step === "email" ? (
						<form onSubmit={handleRequestReset} className="space-y-4">
							<div className="space-y-2">
								<label htmlFor="address" className="text-sm font-medium">
									Primary mailbox address
								</label>
								<Input
									id="address"
									type="email"
									autoComplete="email"
									autoFocus
									placeholder="you@example.com"
									value={address}
									onChange={(event) => setAddress(event.target.value)}
									disabled={submitting}
									required
								/>
								<p className="text-muted-foreground text-xs">
									Use the mailbox address you sign in with.
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
								{submitting ? "Sending…" : "Send reset code"}
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
								Back
							</Button>
						</form>
					) : null}

					{step === "no-recovery" ? (
						<div className="space-y-4">
							<Alert tone="destructive">{NO_RECOVERY_MESSAGE}</Alert>
							<Button
								type="button"
								className="w-full"
								onClick={() => {
									resetMessages();
									setStep("code");
								}}
							>
								I have a reset code
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
								Back
							</Button>
						</div>
					) : null}

					{step === "code" ? (
						<form onSubmit={handleContinueFromCode} className="space-y-4">
							{info ? <Alert tone="success">{info}</Alert> : null}
							<div className="space-y-2">
								<label htmlFor="code" className="text-sm font-medium">
									Reset code
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
									Codes look like <span className="font-mono">AB2C-D4EF</span> and
									expire after a short time.
								</p>
							</div>
							{error ? <Alert tone="destructive">{error}</Alert> : null}
							<Button
								type="submit"
								className="w-full"
								disabled={submitting || !code.trim()}
							>
								{submitting ? (
									<Loader2 className="size-4 animate-spin" aria-hidden />
								) : null}
								{submitting ? "Checking…" : "Continue"}
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
								Back
							</Button>
						</form>
					) : null}

					{step === "password" ? (
						<form onSubmit={handleResetSubmit} className="space-y-4">
							{accountAddress ? (
								<div className="bg-muted flex items-center gap-3 rounded-lg px-4 py-3 text-sm">
									<AtSign className="text-muted-foreground size-4 shrink-0" />
									<div>
										<p className="text-muted-foreground text-xs">Your mailbox</p>
										<p className="font-medium">{accountAddress}</p>
									</div>
								</div>
							) : null}
							<div className="space-y-2">
								<label htmlFor="password" className="text-sm font-medium">
									New password
								</label>
								<PasswordInput
									id="password"
									autoComplete="new-password"
									value={password}
									onChange={(event) => setPassword(event.target.value)}
									disabled={submitting}
									autoFocus
									required
								/>
								<p className="text-muted-foreground text-xs">
									Use a long, unique password you don't use anywhere else.
								</p>
							</div>
							<div className="space-y-2">
								<label htmlFor="confirm-password" className="text-sm font-medium">
									Confirm password
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
										Passwords do not match.
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
								{submitting ? "Resetting…" : "Reset password"}
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
								Back
							</Button>
						</form>
					) : null}
				</CardContent>
			</Card>
			<p className="text-muted-foreground text-center text-sm">
				Remembered it after all?{" "}
				<Link to="/login" className="text-primary font-medium hover:underline">
					Back to sign in
				</Link>
			</p>
		</AuthPageShell>
	);
}
