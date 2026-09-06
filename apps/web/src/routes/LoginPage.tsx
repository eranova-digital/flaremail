import { useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Fingerprint, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { TotpCodeInput, isTotpCodeComplete } from "@/components/auth/TotpCodeInput";
import { PageLoader } from "@/components/PageLoader";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getPostLoginPath, isFullPageReturnTo, isSafeReturnTo } from "@/lib/auth/post-login";
import { isPasskeySupported } from "@/lib/auth/passkey-support";
import { getErrorMessage } from "@/lib/api/errors";
import type { Account } from "@/lib/auth/types";

function isMfaChallenge(
	result: Account | { requiresMfa: true; mfaToken: string },
): result is { requiresMfa: true; mfaToken: string } {
	return "requiresMfa" in result && result.requiresMfa;
}

export function LoginPage() {
	const { t } = useTranslation("auth");
	const { t: tCommon } = useTranslation("common");
	const { account, isAuthenticated, isLoading, signIn, verifyMfa, signInWithPasskey } =
		useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const [searchParams] = useSearchParams();
	const passkeySupported = isPasskeySupported();
	const locationState = location.state as
		| { from?: string; success?: string }
		| null;
	const returnToParam = searchParams.get("return_to");
	const from = isSafeReturnTo(returnToParam)
		? returnToParam
		: locationState?.from;
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
		return <PageLoader label={t("session.checking")} />;
	}

	if (isAuthenticated) {
		const path = getPostLoginPath(account, from);
		if (isFullPageReturnTo(path)) {
			window.location.replace(path);
			return <PageLoader label={t("session.continuing")} />;
		}
		return <Navigate to={path} replace />;
	}

	const finishLogin = (result: Account) => {
		const path = getPostLoginPath(result, from);
		if (isFullPageReturnTo(path)) {
			window.location.replace(path);
			return;
		}
		navigate(path, { replace: true });
	};

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
			finishLogin(result);
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
			finishLogin(me);
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

	const handlePasskeySignIn = async () => {
		if (!passkeySupported || submittingRef.current) {
			return;
		}

		const attempt = ++loginAttemptRef.current;
		setError(null);
		submittingRef.current = true;
		setSubmitting(true);

		try {
			const me = await signInWithPasskey(email.trim() || undefined);
			if (attempt !== loginAttemptRef.current) {
				return;
			}
			finishLogin(me);
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

	return (
		<AuthPageShell
			title={mfaToken ? t("login.mfa.title") : t("login.title")}
			description={
				mfaToken
					? t("login.mfa.description")
					: t("login.description", { appName: tCommon("appName") })
			}
		>
			{success ? <Alert tone="success">{success}</Alert> : null}
			<Card className="rounded-xl py-0 shadow-sm">
				<CardContent className="p-6">
					{mfaToken ? (
						<form onSubmit={handleMfaSubmit} className="space-y-4">
							<div className="space-y-2">
								<label
									htmlFor="mfa-code"
									className="block text-center text-sm font-medium"
								>
									{t("login.mfa.codeLabel")}
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
								{submitting ? t("login.mfa.verifying") : t("login.mfa.continue")}
							</Button>
							<Button
								type="button"
								variant="ghost"
								className="w-full"
								onClick={handleBackToPassword}
								disabled={submitting}
							>
								{t("login.mfa.back")}
							</Button>
						</form>
					) : (
						<form onSubmit={handlePasswordSubmit} className="space-y-4">
							<div className="space-y-2">
								<label htmlFor="email" className="text-sm font-medium">
									{t("login.email")}
								</label>
								<Input
									id="email"
									type={useTextEmailInput ? "text" : "email"}
									autoComplete="email"
									autoFocus
									placeholder={t("login.emailPlaceholder")}
									value={email}
									onChange={(event) => setEmail(event.target.value)}
									disabled={submitting}
									required
								/>
							</div>
							<div className="space-y-2">
								<label htmlFor="password" className="text-sm font-medium">
									{t("login.password")}
								</label>
								<PasswordInput
									id="password"
									autoComplete="current-password"
									value={password}
									onChange={(event) => setPassword(event.target.value)}
									disabled={submitting}
									required
								/>
								<Link
									to="/reset-password"
									className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center text-sm font-medium transition-colors"
								>
									{t("login.forgotPassword")}
								</Link>
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
								{submitting ? t("login.signingIn") : t("login.signIn")}
							</Button>
							{passkeySupported ? (
								<>
									<div className="relative">
										<div className="bg-border absolute inset-x-0 top-1/2 h-px" />
										<p className="text-muted-foreground relative mx-auto w-fit bg-card px-2 text-xs">
											{t("login.or")}
										</p>
									</div>
									<Button
										type="button"
										variant="outline"
										className="w-full"
										onClick={() => void handlePasskeySignIn()}
										disabled={submitting}
									>
										{submitting ? (
											<Loader2 className="size-4 animate-spin" aria-hidden />
										) : (
											<Fingerprint className="size-4" aria-hidden />
										)}
										{t("login.passkey")}
									</Button>
									<p className="text-muted-foreground text-center text-xs">
										{email.trim()
											? t("login.passkeyHintWithEmail")
											: t("login.passkeyHintWithoutEmail")}
									</p>
								</>
							) : null}
						</form>
					)}
				</CardContent>
			</Card>
			{!mfaToken ? (
				<p className="text-muted-foreground text-center text-sm">
					{t("login.haveInvite")}{" "}
					<Link
						to="/activate"
						className="text-primary font-medium hover:underline"
					>
						{t("login.activateLink")}
					</Link>
				</p>
			) : null}
		</AuthPageShell>
	);
}
