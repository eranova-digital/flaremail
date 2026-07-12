import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, Loader2, Mail } from "lucide-react";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { AuthCodeInput } from "@/components/auth/AuthCodeInput";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/AuthProvider";
import { requestPasswordReset } from "@/lib/auth/api";
import {
	getErrorMessage,
	isNoRecoveryEmailError,
} from "@/lib/api/errors";
import { formatAuthCode } from "@/lib/format-auth-code";

type ResetStep = "choose" | "email" | "no-recovery" | "code";

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
	const [code, setCode] = useState(initialCode);
	const [password, setPassword] = useState("");
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
				"We sent a reset code to your recovery email. Enter it below to choose a new password.",
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

	const handleResetSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		resetMessages();
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
					: "Enter reset code";

	const description =
		step === "choose"
			? "Choose how you'd like to reset your password."
			: step === "email"
				? "Enter your primary mailbox address."
				: step === "no-recovery"
					? "Self-service email reset isn't available for this account."
					: "Enter the reset code you received and choose a new password.";

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
						<form onSubmit={handleResetSubmit} className="space-y-4">
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
								{submitting ? "Resetting…" : "Reset password"}
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
