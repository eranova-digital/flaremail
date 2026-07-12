import { useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { TotpCodeInput, isTotpCodeComplete } from "@/components/auth/TotpCodeInput";
import { PageLoader } from "@/components/PageLoader";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getErrorMessage } from "@/lib/api/errors";
import type { Account } from "@/lib/auth/types";

function getPostLoginPath(
	account: { isIntendant: boolean } | null,
	from: string | undefined,
): string {
	if (account?.isIntendant) {
		return "/";
	}

	return from && from !== "/login" ? from : "/";
}

function isMfaChallenge(
	result: Account | { requiresMfa: true; mfaToken: string },
): result is { requiresMfa: true; mfaToken: string } {
	return "requiresMfa" in result && result.requiresMfa;
}

export function LoginPage() {
	const { account, isAuthenticated, isLoading, signIn, verifyMfa } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const locationState = location.state as
		| { from?: string; success?: string }
		| null;
	const from = locationState?.from;
	const success = locationState?.success;

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [mfaToken, setMfaToken] = useState<string | null>(null);
	const [mfaCode, setMfaCode] = useState("");
	const useTextEmailInput = email.trim().toLowerCase() === "intendant";
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const loginAttemptRef = useRef(0);
	const submittingRef = useRef(false);

	if (isLoading) {
		return <PageLoader label="Checking your session…" />;
	}

	if (isAuthenticated) {
		return <Navigate to={getPostLoginPath(account, from)} replace />;
	}

	const handlePasswordSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (submittingRef.current) {
			return;
		}

		setError(null);
		const attempt = ++loginAttemptRef.current;
		submittingRef.current = true;
		setSubmitting(true);

		try {
			const result = await signIn(email.trim(), password);
			if (attempt !== loginAttemptRef.current) {
				return;
			}
			if (isMfaChallenge(result)) {
				setMfaToken(result.mfaToken);
				setMfaCode("");
				return;
			}
			navigate(getPostLoginPath(result, from), { replace: true });
		} catch (submitError) {
			if (attempt === loginAttemptRef.current) {
				setError(getErrorMessage(submitError));
			}
		} finally {
			submittingRef.current = false;
			if (attempt === loginAttemptRef.current) {
				setSubmitting(false);
			}
		}
	};

	const submitMfa = async (code: string) => {
		if (!mfaToken || submittingRef.current || !isTotpCodeComplete(code)) {
			return;
		}

		const attempt = loginAttemptRef.current;
		const challengeToken = mfaToken;
		setError(null);
		submittingRef.current = true;
		setSubmitting(true);

		try {
			const me = await verifyMfa(challengeToken, code.trim());
			if (attempt !== loginAttemptRef.current) {
				return;
			}
			navigate(getPostLoginPath(me, from), { replace: true });
		} catch (submitError) {
			if (attempt === loginAttemptRef.current) {
				setError(getErrorMessage(submitError));
			}
		} finally {
			submittingRef.current = false;
			if (attempt === loginAttemptRef.current) {
				setSubmitting(false);
			}
		}
	};

	const handleMfaSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		await submitMfa(mfaCode);
	};


	const handleBackToPassword = () => {
		loginAttemptRef.current += 1;
		submittingRef.current = false;
		setMfaToken(null);
		setMfaCode("");
		setPassword("");
		setError(null);
		setSubmitting(false);
	};

	return (
		<AuthPageShell
			title={mfaToken ? "Two-factor authentication" : "Welcome back"}
			description={
				mfaToken
					? "Enter the 6-digit code from your authenticator app."
					: "Sign in to your Flaremail account."
			}
		>
			{success ? <Alert tone="success">{success}</Alert> : null}
			<Card className="rounded-xl py-6 shadow-sm">
				<CardContent>
					{mfaToken ? (
						<form onSubmit={handleMfaSubmit} className="space-y-4">
							<div className="space-y-2">
								<label
									htmlFor="mfa-code"
									className="block text-center text-sm font-medium"
								>
									Authenticator code
								</label>
								<TotpCodeInput
									id="mfa-code"
									value={mfaCode}
									onChange={setMfaCode}
									onComplete={(value) => void submitMfa(value)}
									disabled={submitting}
									autoFocus
									invalid={Boolean(error)}
									className="justify-center"
								/>
							</div>
							{error ? <Alert tone="destructive">{error}</Alert> : null}
							<Button
								type="submit"
								className="w-full"
								disabled={submitting || !isTotpCodeComplete(mfaCode)}
							>
								{submitting ? (
									<Loader2 className="size-4 animate-spin" aria-hidden />
								) : null}
								{submitting ? "Verifying…" : "Continue"}
							</Button>
							<Button
								type="button"
								variant="ghost"
								className="w-full"
								onClick={handleBackToPassword}
								disabled={submitting}
							>
								Back to sign in
							</Button>
						</form>
					) : (
						<form onSubmit={handlePasswordSubmit} className="space-y-4">
							<div className="space-y-2">
								<label htmlFor="email" className="text-sm font-medium">
									Email
								</label>
								<Input
									id="email"
									type={useTextEmailInput ? "text" : "email"}
									autoComplete="email"
									autoFocus
									placeholder="you@example.com"
									value={email}
									onChange={(event) => setEmail(event.target.value)}
									disabled={submitting}
									required
								/>
							</div>
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<label htmlFor="password" className="text-sm font-medium">
										Password
									</label>
									<Link
										to="/reset-password"
										className="text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
										tabIndex={-1}
									>
										Forgot password?
									</Link>
								</div>
								<PasswordInput
									id="password"
									autoComplete="current-password"
									value={password}
									onChange={(event) => setPassword(event.target.value)}
									disabled={submitting}
									required
								/>
							</div>
							{error ? <Alert tone="destructive">{error}</Alert> : null}
							<Button
								type="submit"
								className="w-full"
								disabled={submitting || !email.trim() || !password}
							>
								{submitting ? (
									<Loader2 className="size-4 animate-spin" aria-hidden />
								) : null}
								{submitting ? "Signing in…" : "Sign in"}
							</Button>
						</form>
					)}
				</CardContent>
			</Card>
			{!mfaToken ? (
				<p className="text-muted-foreground text-center text-sm">
					Have an invite code?{" "}
					<Link
						to="/activate"
						className="text-primary font-medium hover:underline"
					>
						Activate your account
					</Link>
				</p>
			) : null}
		</AuthPageShell>
	);
}
