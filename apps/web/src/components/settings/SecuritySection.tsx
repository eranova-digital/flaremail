import { useEffect, useState } from "react";
import { ChevronDown, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";

import { PasswordInput } from "@/components/auth/PasswordInput";
import { AuthCodeInput, isAuthCodeComplete } from "@/components/auth/AuthCodeInput";
import { ApiKeysSection } from "@/components/settings/ApiKeysSection";
import { ConnectedAppsSection } from "@/components/settings/ConnectedAppsSection";
import { TotpCodeInput, isTotpCodeComplete } from "@/components/auth/TotpCodeInput";
import { SessionsSection } from "@/components/settings/SessionsSection";
import { PasskeysSection } from "@/components/settings/PasskeysSection";
import { IntendantPasswordSection } from "@/components/settings/IntendantPasswordSection";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
	confirmMfa,
	createApiKey,
	fetchApiKeys,
	disableMfa,
	fetchMfaStatus,
	revokeApiKey,
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
	const { t } = useTranslation("settings");
	const { t: tc } = useTranslation("common");
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
			setSuccess(t("security.mfa.enabledSuccess"));
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
			setSuccess(t("security.mfa.disabledSuccess"));
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
			setSuccess(t("security.mfa.recoveryCodeSent"));
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
				<h2 className="text-lg font-semibold">{t("security.title")}</h2>
				<p className="text-muted-foreground max-w-prose text-sm">
					{t("security.description")}
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
						{t("security.mfa.title")}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{loading ? (
						<p className="text-muted-foreground text-sm">{t("security.mfa.loading")}</p>
					) : enabled ? (
						<>
							<p className="text-sm">
								{t("security.mfa.enabled", {
									since: enabledAt
										? t("security.mfa.since", { enabledAt })
										: "",
								})}
							</p>
							{mfaRequiredByOrganization ? (
								<p className="text-muted-foreground text-sm">
									{t("security.mfa.orgRequired")}
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
											{t("security.mfa.disableTitle")}
										</p>
										<p className="text-muted-foreground text-xs">
											{usesRecoveryCodeForDisable
												? t("security.mfa.disableHintRecovery")
												: t("security.mfa.disableHintTotp")}
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
												? t("security.mfa.disableBodyRecovery")
												: t("security.mfa.disableBodyTotp")}
										</p>
										<div className="grid gap-3 sm:max-w-sm">
											<div className="space-y-2">
												<label
													htmlFor="disable-password"
													className="text-sm font-medium"
												>
													{t("security.mfa.password")}
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
														? t("security.mfa.recoveryEmailCode")
														: t("security.mfa.authenticatorCode")}
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
																? t("security.mfa.resendCode")
																: t("security.mfa.sendCode")}
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
												{t("security.mfa.disableButton")}
											</Button>
										</div>
									</div>
								) : null}
							</div>
							)}
						</>
					) : setupStep === "scan" && setup ? (
						<div className="space-y-4">
							<p className="text-sm">{t("security.mfa.scanBody")}</p>
							<div className="flex flex-col gap-4 sm:flex-row sm:items-start">
								<div className="bg-background inline-flex rounded-lg border p-3">
									<QRCodeSVG value={setup.otpauthUrl} size={160} />
								</div>
								<div className="space-y-2 text-sm">
									<p className="font-medium">{t("security.mfa.cantScan")}</p>
									<p className="text-muted-foreground">
										{t("security.mfa.manualKey")}
									</p>
									<code className="bg-muted block rounded px-2 py-1 font-mono text-xs break-all">
										{setup.secret}
									</code>
								</div>
							</div>
							<div className="grid gap-3 sm:max-w-xs">
								<div className="space-y-2">
									<label htmlFor="confirm-code" className="text-sm font-medium">
										{t("security.mfa.verificationCode")}
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
										{t("security.mfa.enableButton")}
									</Button>
									<Button
										variant="outline"
										onClick={handleCancelSetup}
										disabled={submitting}
									>
										{tc("cancel")}
									</Button>
								</div>
							</div>
						</div>
					) : (
						<>
							<p className="text-muted-foreground text-sm">
								{t("security.mfa.setupIdleBody")}
							</p>
							<Button onClick={handleStartSetup} disabled={submitting}>
								{submitting ? (
									<Loader2 className="size-4 animate-spin" aria-hidden />
								) : null}
								{t("security.mfa.setupButton")}
							</Button>
						</>
					)}
				</CardContent>
			</Card>

			{account.isIntendant ? (
				<IntendantPasswordSection mfaEnabled={enabled} />
			) : null}

			<PasskeysSection />

			<ConnectedAppsSection />

			<ApiKeysSection
				title={t("apiKeys.title")}
				description={t("apiKeys.description")}
				emptyState={t("apiKeys.empty")}
				createLabel={t("apiKeys.create")}
				dialogTitle={t("apiKeys.dialogTitle")}
				dialogDescription={t("apiKeys.dialogDescription")}
				namePlaceholder={t("apiKeys.namePlaceholder")}
				secretTitle={t("apiKeys.secretTitle")}
				loadKeys={fetchApiKeys}
				createKey={createApiKey}
				revokeKey={revokeApiKey}
			/>

			<SessionsSection />
		</div>
	);
}
