import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Loader2, Mail, Shield, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import {
	getAccountDisplayName,
	ProfileAvatar,
} from "@/components/ProfileAvatar";
import { PageLoader } from "@/components/PageLoader";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getErrorMessage } from "@/lib/api/errors";
import {
	fetchOidcPending,
	oidcClientLogoUrl,
	submitOidcConsent,
	type OidcPending,
} from "@/lib/oidc/api";

const SCOPE_ICONS: Record<string, typeof UserRound> = {
	openid: Shield,
	profile: UserRound,
	email: Mail,
	"mail:read": Mail,
	"mail:send": Mail,
};

const SCOPE_KEYS: Record<string, "openid" | "profile" | "email" | "mailRead" | "mailSend"> = {
	openid: "openid",
	profile: "profile",
	email: "email",
	"mail:read": "mailRead",
	"mail:send": "mailSend",
};

export function ConsentPage() {
	const { t } = useTranslation("auth");
	const { t: tCommon } = useTranslation("common");
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
		return <PageLoader label={t("session.checking")} />;
	}

	if (!isAuthenticated) {
		const returnTo = pendingId
			? `/oauth/consent?pending=${encodeURIComponent(pendingId)}`
			: "/oauth/consent";
		return <Navigate to="/login" replace state={{ from: returnTo }} />;
	}

	if (account?.isIntendant) {
		return (
			<AuthPageShell title={t("consent.cannotAuthorizeTitle")}>
				<Card className="rounded-xl py-6 shadow-sm">
					<CardContent className="space-y-4">
						<Alert tone="destructive">{t("consent.cannotAuthorizeBody")}</Alert>
						<Button asChild className="w-full">
							<Link to="/management">{tCommon("management")}</Link>
						</Button>
					</CardContent>
				</Card>
			</AuthPageShell>
		);
	}

	if (!pendingId) {
		return (
			<AuthPageShell title={t("consent.invalidRequestTitle")}>
				<Card className="rounded-xl py-6 shadow-sm">
					<CardContent className="space-y-4">
						<Alert tone="destructive">{t("consent.missingPending")}</Alert>
						<Button asChild className="w-full">
							<Link to="/login">{t("login.signIn")}</Link>
						</Button>
					</CardContent>
				</Card>
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
	const appName = tCommon("appName");

	const scopeMeta = (scope: string) => {
		const key = SCOPE_KEYS[scope];
		const Icon = SCOPE_ICONS[scope] ?? Shield;
		if (!key) {
			return {
				title: scope,
				description: t("consent.scopes.fallbackDescription"),
				icon: Icon,
			};
		}
		return {
			title: t(`consent.scopes.${key}.title`),
			description: t(`consent.scopes.${key}.description`, { appName }),
			icon: Icon,
		};
	};

	return (
		<AuthPageShell
			title={
				pending
					? t("consent.titleWithClient", { clientName: pending.clientName })
					: t("consent.titleFallback")
			}
			description={
				pending
					? t("consent.descriptionWithClient", { appName })
					: t("consent.descriptionFallback")
			}
		>
			{error ? <Alert tone="destructive">{error}</Alert> : null}
			{!pending && !error ? (
				<p className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
					<Loader2 className="size-4 animate-spin" />
					{t("consent.loading")}
				</p>
			) : null}
			{pending && account ? (
				<Card className="overflow-hidden shadow-sm">
					<CardContent className="space-y-5 p-5">
						<div className="flex flex-col items-center gap-3 text-center">
							<ProfileAvatar
								seed={pending.clientId}
								label={pending.clientName}
								imageUrl={logoUrl}
								shape="rounded-square"
								className="size-16 text-lg shadow-sm"
							/>
							<div className="min-w-0 space-y-0.5">
								<p className="text-base font-semibold tracking-tight">
									{pending.clientName}
								</p>
								<p className="text-muted-foreground text-xs">
									{t("consent.wantsAccess")}
								</p>
							</div>
						</div>

						<div className="bg-muted/50 flex items-center gap-3 rounded-xl border px-3 py-2.5">
							<ProfileAvatar
								accountId={account.id}
								seed={account.loginIdentifier}
								label={displayName}
								profilePicture={account.profilePicture}
								className="size-10 text-xs"
							/>
							<div className="min-w-0 flex-1 text-left">
								<p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
									{t("consent.signedInAs")}
								</p>
								<p className="truncate text-sm font-medium">{displayName}</p>
								<p className="text-muted-foreground truncate text-xs">
									{account.loginIdentifier}
								</p>
							</div>
						</div>

						<Separator />

						<div className="space-y-3">
							<p className="text-sm font-medium">
								{t("consent.willAllow", { clientName: pending.clientName })}
							</p>
							<ul className="space-y-3">
								{pending.scopes.map((scope) => {
									const meta = scopeMeta(scope);
									const Icon = meta.icon;
									return (
										<li key={scope} className="flex gap-3">
											<span className="bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg">
												<Icon className="size-4" aria-hidden />
											</span>
											<span className="min-w-0">
												<span className="block text-sm font-medium">
													{meta.title}
												</span>
												<span className="text-muted-foreground block text-xs text-pretty">
													{meta.description}
												</span>
											</span>
										</li>
									);
								})}
							</ul>
						</div>

						<div className="space-y-2 pt-1">
							<Button
								type="button"
								className="w-full"
								disabled={submitting}
								onClick={() => void decide("approve")}
							>
								{submitting ? (
									<Loader2 className="size-4 animate-spin" />
								) : null}
								{t("consent.continueTo", { clientName: pending.clientName })}
							</Button>
							<Button
								type="button"
								variant="outline"
								className="w-full"
								disabled={submitting}
								onClick={() => void decide("deny")}
							>
								{t("consent.deny")}
							</Button>
							<Button
								type="button"
								variant="ghost"
								className="text-muted-foreground w-full"
								disabled={submitting}
								onClick={cancel}
							>
								{pending.homescreenUrl
									? t("consent.cancelAndGoBack")
									: t("consent.cancel")}
							</Button>
						</div>
					</CardContent>
				</Card>
			) : null}
		</AuthPageShell>
	);
}
