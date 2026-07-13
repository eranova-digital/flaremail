import { useEffect, useState } from "react";
import { ChevronDown, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { PasswordInput } from "@/components/auth/PasswordInput";
import { AuthCodeInput, isAuthCodeComplete } from "@/components/auth/AuthCodeInput";
import { TotpCodeInput, isTotpCodeComplete } from "@/components/auth/TotpCodeInput";
import { SessionsSection } from "@/components/settings/SessionsSection";
import { PasskeysSection } from "@/components/settings/PasskeysSection";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
	confirmMfa,
	disableMfa,
	fetchMfaStatus,
	sendMfaDisableRecoveryCode,
	setupMfa,
} from "@/lib/auth/api";
import type { MfaSetup, MfaStatus } from "@/lib/auth/types";
import { getErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

type SetupStep = "idle" | "scan" | "confirm";

function formatEnabledDate(value: string | null | undefined): string | null {
	if (!value) {
		return null;
	}
	return new Date(value).toLocaleDateString(undefined, {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

export function SecuritySection() {
	const { account, refresh } = useAuth();
	const [status, setStatus] = useState<MfaStatus | null>(null);
	const [setup, setSetup] = useState<MfaSetup | null>(null);
	const [setupStep, setSetupStep] = useState<SetupStep>("idle");
	const [confirmCode, setConfirmCode] = useState("");
	const [disableOpen, setDisableOpen] = useState(false);
	const [disablePassword, setDisablePassword] = useState("");
	const [disableCode, setDisableCode] = useState("");
	const [recoveryCodeSent, setRecoveryCodeSent] = useState(false);
	const [sendingRecoveryCode, setSendingRecoveryCode] = useState(false);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		(async () => {
			try {
				const nextStatus = await fetchMfaStatus();
				if (!cancelled) {
					setStatus(nextStatus);
				}
			} catch (loadError) {
				if (!cancelled) {
					setError(getErrorMessage(loadError));
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [account?.id]);

	if (!account) {
		return null;
	}

	const enabled = status?.enabled ?? account.mfaEnabled ?? false;
	const enabledAt = formatEnabledDate(status?.enabledAt ?? account.mfaEnabledAt);
	const hasRecoveryEmail = Boolean(account.profile?.recoveryAddress?.trim());
	const usesRecoveryCodeForDisable = hasRecoveryEmail;
	const mfaRequiredByOrganization =
		account.organizationPolicies?.mfaRequired ?? false;

	const resetMessages = () => {
		setError(null);
		setSuccess(null);
	};

	const handleStartSetup = async () => {
		resetMessages();
		setSubmitting(true);
		try {
			const nextSetup = await setupMfa();
			setSetup(nextSetup);
			setSetupStep("scan");
			setConfirmCode("");
		} catch (setupError) {
			setError(getErrorMessage(setupError));
		} finally {
			setSubmitting(false);
		}
	};

	const handleConfirmSetup = async (code = confirmCode) => {
		if (submitting || !isTotpCodeComplete(code)) {
			return;
		}
		resetMessages();
		setSubmitting(true);
		try {
			const nextStatus = await confirmMfa(code.trim());
			setStatus(nextStatus);
			setSetup(null);
			setSetupStep("idle");
			setConfirmCode("");
			setSuccess("Two-factor authentication is now enabled.");
			await refresh();
		} catch (confirmError) {
			setError(getErrorMessage(confirmError));
		} finally {
			setSubmitting(false);
		}
	};


	const handleDisable = async () => {
		resetMessages();
		setSubmitting(true);
		try {
			const nextStatus = await disableMfa({
				password: disablePassword,
				code: disableCode.trim(),
			});
			setStatus(nextStatus);
			setDisableOpen(false);
			setDisablePassword("");
			setDisableCode("");
			setRecoveryCodeSent(false);
			setSuccess("Two-factor authentication has been disabled.");
			await refresh();
		} catch (disableError) {
			setError(getErrorMessage(disableError));
		} finally {
			setSubmitting(false);
		}
	};

	const handleSendRecoveryCode = async () => {
		resetMessages();
		setSendingRecoveryCode(true);
		try {
			await sendMfaDisableRecoveryCode();
			setRecoveryCodeSent(true);
			setDisableCode("");
			setSuccess("We sent a verification code to your recovery email.");
		} catch (sendError) {
			setError(getErrorMessage(sendError));
		} finally {
			setSendingRecoveryCode(false);
		}
	};

	const handleCancelSetup = () => {
		setSetup(null);
		setSetupStep("idle");
		setConfirmCode("");
		resetMessages();
	};

	return (
		<div className="space-y-6">
			<div className="space-y-2">
				<h2 className="text-lg font-semibold">Security</h2>
				<p className="text-muted-foreground max-w-prose text-sm">
					Protect your account with an authenticator app or passkey, review active
					sessions, and manage sign-in security settings.
				</p>
			</div>

			{error ? <Alert tone="destructive">{error}</Alert> : null}
			{success ? <Alert tone="success">{success}</Alert> : null}

			<Card className="rounded-xl shadow-sm">
				<CardHeader className="pb-4">
					<CardTitle className="flex items-center gap-2 text-base">
						{enabled ? (
							<ShieldCheck className="text-primary size-4" aria-hidden />
						) : (
							<ShieldOff className="text-muted-foreground size-4" aria-hidden />
						)}
						Two-factor authentication
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{loading ? (
						<p className="text-muted-foreground text-sm">Loading security settings…</p>
					) : enabled ? (
						<>
							<p className="text-sm">
								Two-factor authentication is enabled
								{enabledAt ? ` since ${enabledAt}` : ""}. You will be asked for a
								code from your authenticator app when signing in.
							</p>
							{mfaRequiredByOrganization ? (
								<p className="text-muted-foreground text-sm">
									Your organization requires two-factor authentication for your
									account, so it cannot be disabled.
								</p>
							) : (
							<div className="rounded-md border">
								<button
									type="button"
									onClick={() => {
										setDisableOpen((current) => {
											if (current) {
												setDisablePassword("");
												setDisableCode("");
												setRecoveryCodeSent(false);
											}
											return !current;
										});
									}}
									aria-expanded={disableOpen}
									className="hover:bg-muted/40 flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
								>
									<div>
										<p className="text-sm font-medium">
											Disable two-factor authentication
										</p>
										<p className="text-muted-foreground text-xs">
											{usesRecoveryCodeForDisable
												? "Requires your password and a code sent to your recovery email."
												: "Requires your password and a current authenticator code."}
										</p>
									</div>
									<ChevronDown
										className={cn(
											"text-muted-foreground size-4 shrink-0 transition-transform",
											disableOpen && "rotate-180",
										)}
									/>
								</button>
								{disableOpen ? (
									<div className="space-y-3 border-t px-3 py-3">
										<p className="text-muted-foreground text-sm">
											{usesRecoveryCodeForDisable
												? "Enter your password and the verification code we send to your recovery email."
												: "Enter your password and a current authenticator code to turn off 2FA."}
										</p>
										<div className="grid gap-3 sm:max-w-sm">
											<div className="space-y-2">
												<label
													htmlFor="disable-password"
													className="text-sm font-medium"
												>
													Password
												</label>
												<PasswordInput
													id="disable-password"
													value={disablePassword}
													onChange={(event) =>
														setDisablePassword(event.target.value)
													}
													disabled={submitting}
													autoComplete="current-password"
												/>
											</div>
											<div className="space-y-2">
												<label htmlFor="disable-code" className="text-sm font-medium">
													{usesRecoveryCodeForDisable
														? "Recovery email code"
														: "Authenticator code"}
												</label>
												{usesRecoveryCodeForDisable ? (
													<>
														<AuthCodeInput
															id="disable-code"
															value={disableCode}
															onChange={setDisableCode}
															disabled={submitting || !recoveryCodeSent}
															invalid={Boolean(error)}
														/>
														<Button
															type="button"
															variant="outline"
															size="sm"
															onClick={handleSendRecoveryCode}
															disabled={
																sendingRecoveryCode ||
																submitting ||
																disablePassword.length === 0
															}
														>
															{sendingRecoveryCode ? (
																<Loader2
																	className="size-4 animate-spin"
																	aria-hidden
																/>
															) : null}
															{recoveryCodeSent
																? "Resend code"
																: "Send code to recovery email"}
														</Button>
													</>
												) : (
													<TotpCodeInput
														id="disable-code"
														value={disableCode}
														onChange={setDisableCode}
														disabled={submitting}
														invalid={Boolean(error)}
													/>
												)}
											</div>
											<Button
												variant="destructive"
												onClick={handleDisable}
												disabled={
													submitting ||
													disablePassword.length === 0 ||
													(usesRecoveryCodeForDisable
														? !isAuthCodeComplete(disableCode)
														: !isTotpCodeComplete(disableCode))
												}
											>
												{submitting ? (
													<Loader2 className="size-4 animate-spin" aria-hidden />
												) : null}
												Disable 2FA
											</Button>
										</div>
									</div>
								) : null}
							</div>
							)}
						</>
					) : setupStep === "scan" && setup ? (
						<div className="space-y-4">
							<p className="text-sm">
								Scan this QR code with your authenticator app, then enter the
								6-digit code to finish setup.
							</p>
							<div className="flex flex-col gap-4 sm:flex-row sm:items-start">
								<div className="bg-background inline-flex rounded-lg border p-3">
									<QRCodeSVG value={setup.otpauthUrl} size={160} />
								</div>
								<div className="space-y-2 text-sm">
									<p className="font-medium">Can&apos;t scan the code?</p>
									<p className="text-muted-foreground">
										Enter this key manually in your authenticator app:
									</p>
									<code className="bg-muted block rounded px-2 py-1 font-mono text-xs break-all">
										{setup.secret}
									</code>
								</div>
							</div>
							<div className="grid gap-3 sm:max-w-xs">
								<div className="space-y-2">
									<label htmlFor="confirm-code" className="text-sm font-medium">
										Verification code
									</label>
									<TotpCodeInput
										id="confirm-code"
										value={confirmCode}
										onChange={setConfirmCode}
										onComplete={(value) => void handleConfirmSetup(value)}
										disabled={submitting}
										autoFocus
										invalid={Boolean(error)}
									/>
								</div>
								<div className="flex flex-wrap gap-2">
									<Button
										onClick={() => void handleConfirmSetup()}
										disabled={submitting || !isTotpCodeComplete(confirmCode)}
									>
										{submitting ? (
											<Loader2 className="size-4 animate-spin" aria-hidden />
										) : null}
										Enable 2FA
									</Button>
									<Button
										variant="outline"
										onClick={handleCancelSetup}
										disabled={submitting}
									>
										Cancel
									</Button>
								</div>
							</div>
						</div>
					) : (
						<>
							<p className="text-muted-foreground text-sm">
								Add a second step to sign-in using an app like Google Authenticator,
								1Password, or Authy.
							</p>
							<Button onClick={handleStartSetup} disabled={submitting}>
								{submitting ? (
									<Loader2 className="size-4 animate-spin" aria-hidden />
								) : null}
								Set up authenticator app
							</Button>
						</>
					)}
				</CardContent>
			</Card>

			<PasskeysSection />

			<SessionsSection />
		</div>
	);
}
