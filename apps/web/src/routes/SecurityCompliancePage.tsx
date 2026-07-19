import { useMemo } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { MfaSetupPanel } from "@/components/auth/MfaSetupPanel";
import { RecoveryEmailSetup } from "@/components/auth/RecoveryEmailSetup";
import { SettingsShell } from "@/components/layout/SettingsShell";
import { PageLoader } from "@/components/PageLoader";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth/AuthProvider";

type ComplianceStep = "recovery" | "mfa";

function resolveComplianceStep(account: {
	securityRequirements?: { recoveryEmail: boolean; mfa: boolean };
}): ComplianceStep | null {
	const requirements = account.securityRequirements;
	if (requirements?.recoveryEmail) {
		return "recovery";
	}
	if (requirements?.mfa) {
		return "mfa";
	}
	return null;
}

export function SecurityCompliancePage() {
	const { t } = useTranslation("auth");
	const { account, isLoading, refresh } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const from =
		(location.state as { from?: string } | null)?.from &&
		(location.state as { from?: string }).from !== "/security-compliance"
			? (location.state as { from?: string }).from
			: "/";

	const step = useMemo(
		() => (account ? resolveComplianceStep(account) : null),
		[account],
	);

	if (isLoading) {
		return <PageLoader label={t("session.checking")} />;
	}

	if (!account) {
		return <Navigate to="/login" replace />;
	}

	if (!step) {
		return <Navigate to={from ?? "/"} replace />;
	}

	const handleComplete = async () => {
		await refresh();
	};

	return (
		<SettingsShell backTo={from} backLabel={t("securityCompliance.back")}>
			<div className="mx-auto w-full max-w-lg space-y-4">
				<div>
					<h1 className="text-xl font-semibold">{t("securityCompliance.title")}</h1>
					<p className="text-muted-foreground mt-1 text-sm">
						{step === "recovery"
							? t("securityCompliance.descriptionRecovery")
							: t("securityCompliance.descriptionMfa")}
					</p>
				</div>

				<Card className="rounded-xl py-6 shadow-sm">
					<CardContent>
						{step === "recovery" ? (
							<RecoveryEmailSetup
								initialEmail={account.profile?.recoveryAddress ?? ""}
								showSkip={false}
								submitLabel={t("securityCompliance.verifyRecovery")}
								onComplete={handleComplete}
							/>
						) : (
							<MfaSetupPanel
								submitLabel={t("securityCompliance.enableMfa")}
								onComplete={async () => {
									await handleComplete();
									navigate(from ?? "/", { replace: true });
								}}
							/>
						)}
					</CardContent>
				</Card>
			</div>
		</SettingsShell>
	);
}
