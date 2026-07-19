import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Check, Copy, Loader2, ShieldCheck } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { PageLoader } from "@/components/PageLoader";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { bootstrapInstance } from "@/lib/auth/api";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getErrorMessage } from "@/lib/api/errors";

const INTENDANT_LOGIN = "intendant";

type BootstrapState =
	| { kind: "idle" }
	| { kind: "loading" }
	| { kind: "created"; password: string }
	| { kind: "exists" }
	| { kind: "error"; message: string };

export function BootstrapPage() {
	const { t } = useTranslation("auth");
	const { t: tCommon } = useTranslation("common");
	const { isAuthenticated, isLoading, account } = useAuth();
	const [state, setState] = useState<BootstrapState>({ kind: "idle" });
	const [copied, setCopied] = useState(false);

	if (isLoading) {
		return <PageLoader label={t("session.checking")} />;
	}

	if (isAuthenticated && account) {
		return <Navigate to={account.isIntendant ? "/management" : "/"} replace />;
	}

	const handleBootstrap = async () => {
		setState({ kind: "loading" });
		setCopied(false);

		try {
			const result = await bootstrapInstance();
			if (result.created && result.password) {
				setState({ kind: "created", password: result.password });
				return;
			}
			setState({ kind: "exists" });
		} catch (error) {
			setState({ kind: "error", message: getErrorMessage(error) });
		}
	};

	const handleCopyPassword = async () => {
		if (state.kind !== "created") {
			return;
		}
		try {
			await navigator.clipboard.writeText(state.password);
			setCopied(true);
		} catch {
			setCopied(false);
		}
	};

	return (
		<AuthPageShell
			title={t("bootstrap.title", { appName: tCommon("appName") })}
			description={t("bootstrap.description")}
		>
			<Card className="rounded-xl py-6 shadow-sm">
				<CardContent className="space-y-4">
					{state.kind === "idle" || state.kind === "loading" ? (
						<>
							<div className="flex items-start gap-3">
								<ShieldCheck className="text-muted-foreground mt-0.5 size-4 shrink-0" />
								<p className="text-muted-foreground text-sm">
									<Trans
										i18nKey="bootstrap.intro"
										ns="auth"
										values={{ login: INTENDANT_LOGIN }}
										components={{
											login: <span className="font-mono text-xs" />,
										}}
									/>
								</p>
							</div>
							<Button
								className="w-full"
								onClick={handleBootstrap}
								disabled={state.kind === "loading"}
							>
								{state.kind === "loading" ? (
									<Loader2 className="size-4 animate-spin" aria-hidden />
								) : null}
								{state.kind === "loading"
									? t("bootstrap.creating")
									: t("bootstrap.createAccount")}
							</Button>
						</>
					) : null}

					{state.kind === "created" ? (
						<div className="space-y-4">
							<Alert tone="success" title={t("bootstrap.createdTitle")}>
								<p>{t("bootstrap.createdBody")}</p>
							</Alert>
							<div className="space-y-2">
								<label className="text-sm font-medium" htmlFor="bootstrap-login">
									{t("bootstrap.loginIdentifier")}
								</label>
								<Input id="bootstrap-login" value={INTENDANT_LOGIN} readOnly />
							</div>
							<div className="space-y-2">
								<label
									className="text-sm font-medium"
									htmlFor="bootstrap-password"
								>
									{t("bootstrap.password")}
								</label>
								<div className="flex gap-2">
									<Input
										id="bootstrap-password"
										value={state.password}
										readOnly
										className="font-mono text-sm"
									/>
									<Button
										type="button"
										variant="outline"
										onClick={handleCopyPassword}
										className="shrink-0"
									>
										{copied ? (
											<Check className="size-4" aria-hidden />
										) : (
											<Copy className="size-4" aria-hidden />
										)}
										{copied ? t("bootstrap.copied") : t("bootstrap.copy")}
									</Button>
								</div>
							</div>
							<Button asChild className="w-full">
								<Link to="/login">{t("bootstrap.continueToSignIn")}</Link>
							</Button>
						</div>
					) : null}

					{state.kind === "exists" ? (
						<div className="space-y-4">
							<Alert tone="info" title={t("bootstrap.existsTitle")}>
								<p>{t("bootstrap.existsBody")}</p>
							</Alert>
							<Button asChild className="w-full" variant="outline">
								<Link to="/login">{t("bootstrap.goToSignIn")}</Link>
							</Button>
						</div>
					) : null}

					{state.kind === "error" ? (
						<div className="space-y-4">
							<Alert tone="destructive" title={t("bootstrap.failedTitle")}>
								<p>{state.message}</p>
							</Alert>
							<Button className="w-full" onClick={handleBootstrap}>
								{t("bootstrap.tryAgain")}
							</Button>
						</div>
					) : null}
				</CardContent>
			</Card>
		</AuthPageShell>
	);
}
