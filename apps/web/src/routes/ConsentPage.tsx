import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { PageLoader } from "@/components/PageLoader";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getErrorMessage } from "@/lib/api/errors";
import {
	fetchOidcPending,
	submitOidcConsent,
	type OidcPending,
} from "@/lib/oidc/api";

export function ConsentPage() {
	const { account, isAuthenticated, isLoading } = useAuth();
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const pendingId = searchParams.get("pending");
	const [pending, setPending] = useState<OidcPending | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		if (!pendingId || !isAuthenticated) {
			return;
		}
		let cancelled = false;
		void (async () => {
			try {
				const result = await fetchOidcPending(pendingId);
				if (!cancelled) {
					setPending(result);
				}
			} catch (loadError) {
				if (!cancelled) {
					setError(getErrorMessage(loadError));
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [pendingId, isAuthenticated]);

	if (isLoading) {
		return <PageLoader label="Checking your session…" />;
	}

	if (!isAuthenticated) {
		const returnTo = pendingId
			? `/oauth/consent?pending=${encodeURIComponent(pendingId)}`
			: "/oauth/consent";
		return (
			<Navigate to="/login" replace state={{ from: returnTo }} />
		);
	}

	if (account?.isIntendant) {
		return (
			<AuthPageShell title="Cannot authorize">
				<Alert tone="destructive">
					The intendant account cannot authorize OIDC clients.
				</Alert>
			</AuthPageShell>
		);
	}

	if (!pendingId) {
		return (
			<AuthPageShell title="Invalid request">
				<Alert tone="destructive">Missing pending authorization.</Alert>
			</AuthPageShell>
		);
	}

	const decide = async (decision: "approve" | "deny") => {
		setSubmitting(true);
		setError(null);
		try {
			const result = await submitOidcConsent({ pendingId, decision });
			window.location.assign(result.redirectTo);
		} catch (decideError) {
			setError(getErrorMessage(decideError));
			setSubmitting(false);
		}
	};

	return (
		<AuthPageShell
			title="Authorize application"
			description={
				pending
					? `${pending.clientName} wants access to your Flaremail account.`
					: "Review the requested permissions."
			}
		>
			{error ? <Alert tone="destructive">{error}</Alert> : null}
			{!pending && !error ? (
				<p className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
					<Loader2 className="size-4 animate-spin" />
					Loading…
				</p>
			) : null}
			{pending ? (
				<Card>
					<CardContent className="space-y-4 pt-6">
						<div>
							<p className="text-sm font-medium">{pending.clientName}</p>
							<p className="text-muted-foreground font-mono text-xs">
								{pending.clientId}
							</p>
						</div>
						<div>
							<p className="mb-2 text-sm font-medium">Requested scopes</p>
							<ul className="text-muted-foreground list-inside list-disc text-sm">
								{pending.scopes.map((scope) => (
									<li key={scope}>{scope}</li>
								))}
							</ul>
						</div>
						<div className="flex gap-2">
							<Button
								type="button"
								className="flex-1"
								disabled={submitting}
								onClick={() => void decide("approve")}
							>
								{submitting ? <Loader2 className="size-4 animate-spin" /> : null}
								Allow
							</Button>
							<Button
								type="button"
								variant="outline"
								className="flex-1"
								disabled={submitting}
								onClick={() => void decide("deny")}
							>
								Deny
							</Button>
						</div>
						<Button
							type="button"
							variant="ghost"
							className="w-full"
							onClick={() => navigate("/")}
						>
							Cancel
						</Button>
					</CardContent>
				</Card>
			) : null}
		</AuthPageShell>
	);
}
