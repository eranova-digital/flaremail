import { Navigate, Outlet, useLocation } from "react-router-dom";

import { PasskeyReminderGate } from "@/components/auth/PasskeyReminderGate";
import { PageLoader } from "@/components/PageLoader";
import { useAuth } from "@/lib/auth/AuthProvider";

function hasPendingSecurityRequirements(account: {
	securityRequirements?: { recoveryEmail: boolean; mfa: boolean };
}): boolean {
	const requirements = account.securityRequirements;
	return Boolean(requirements?.recoveryEmail || requirements?.mfa);
}

export function RequireSecurityCompliance() {
	const { account, isLoading } = useAuth();
	const location = useLocation();

	if (isLoading) {
		return <PageLoader label="Checking your session…" />;
	}

	if (!account) {
		return null;
	}

	if (!hasPendingSecurityRequirements(account)) {
		return <PasskeyReminderGate />;
	}

	if (location.pathname === "/security-compliance") {
		return <Outlet />;
	}

	return (
		<Navigate
			to="/security-compliance"
			replace
			state={{ from: location.pathname }}
		/>
	);
}
