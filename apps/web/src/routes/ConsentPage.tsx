import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import {
	getAccountDisplayName,
	ProfileAvatar,
} from "@/components/ProfileAvatar";
import { PageLoader } from "@/components/PageLoader";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getErrorMessage } from "@/lib/api/errors";
import {
	fetchOidcPending,
	oidcClientLogoUrl,
	submitOidcConsent,
	type OidcPending,
} from "@/lib/oidc/api";

export function ConsentPage() {
	const { account, isAuthenticated, isLoading } = useAuth();
	const [searchParams] = useSearchParams();
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

	const cancel = () => {
		const homescreen = pending?.homescreenUrl?.trim();
		if (homescreen) {
			window.location.assign(homescreen);
			return;
		}
		window.location.assign("/");
	};

	const displayName = account ? getAccountDisplayName(account) : "";
	const logoUrl = pending
		? oidcClientLogoUrl(pending.clientRecordId, pending.logo, "large")
		: null;

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
			{pending && account ? (
				<Card>
					<CardContent className="space-y-4 pt-6">
						<div className="bg-muted/40 flex items-center gap-3 rounded-lg p-3">
							<ProfileAvatar
								accountId={account.id}
								seed={account.loginIdentifier}
								label={displayName}
								profilePicture={account.profilePicture}
								className="size-12 text-sm"
							/>
							<div className="min-w-0">
								<p className="truncate text-sm font-medium">{displayName}</p>
								<p className="text-muted-foreground truncate text-xs">
									{account.loginIdentifier}
								</p>
							</div>
						</div>
						<div className="flex items-center gap-3">
							<ProfileAvatar
								seed={pending.clientId}
								label={pending.clientName}
								imageUrl={logoUrl}
								shape="rounded-square"
								className="size-12 text-sm"
							/>
							<div className="min-w-0">
								<p className="truncate text-sm font-medium">
									{pending.clientName}
								</p>
								<p className="text-muted-foreground font-mono truncate text-xs">
									{pending.clientId}
								</p>
							</div>
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
							disabled={submitting}
							onClick={cancel}
						>
							Cancel
						</Button>
					</CardContent>
				</Card>
			) : null}
		</AuthPageShell>
	);
}
