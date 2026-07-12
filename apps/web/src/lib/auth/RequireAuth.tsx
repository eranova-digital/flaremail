import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/lib/auth/AuthProvider";
import { PageLoader } from "@/components/PageLoader";

export function RequireAuth() {
	const { isAuthenticated, isLoading } = useAuth();
	const location = useLocation();

	if (isLoading) {
		return <PageLoader label="Checking your session…" />;
	}

	if (!isAuthenticated) {
		return <Navigate to="/login" state={{ from: location.pathname }} replace />;
	}

	return <Outlet />;
}
