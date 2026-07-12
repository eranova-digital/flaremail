import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/lib/auth/AuthProvider";
import { Skeleton } from "@/components/ui/skeleton";

export function RequireAuth() {
	const { isAuthenticated, isLoading } = useAuth();
	const location = useLocation();

	if (isLoading) {
		return (
			<div className="flex min-h-svh items-center justify-center p-8">
				<Skeleton className="h-8 w-48" />
			</div>
		);
	}

	if (!isAuthenticated) {
		return <Navigate to="/login" state={{ from: location.pathname }} replace />;
	}

	return <Outlet />;
}
