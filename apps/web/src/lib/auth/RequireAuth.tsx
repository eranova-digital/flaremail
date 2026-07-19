import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAuth } from "@/lib/auth/AuthProvider";
import { PageLoader } from "@/components/PageLoader";

export function RequireAuth() {
	const { t } = useTranslation("auth");
	const { isAuthenticated, isLoading } = useAuth();
	const location = useLocation();

	if (isLoading) {
		return <PageLoader label={t("session.checking")} />;
	}

	if (!isAuthenticated) {
		return <Navigate to="/login" state={{ from: location.pathname }} replace />;
	}

	return <Outlet />;
}
