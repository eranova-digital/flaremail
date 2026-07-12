import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Check, Copy, Loader2, ShieldCheck } from "lucide-react";

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
	const { isAuthenticated, isLoading, account } = useAuth();
	const [state, setState] = useState<BootstrapState>({ kind: "idle" });
	const [copied, setCopied] = useState(false);

	if (isLoading) {
		return <PageLoader label="Checking your session…" />;
	}

	if (isAuthenticated && account) {
		return <Navigate to={account.isIntendant ? "/settings" : "/"} replace />;
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
			title="Set up Flaremail"
			description="Create the recovery account for this instance so you can sign in and configure everything else."
		>
			<Card className="rounded-xl py-6 shadow-sm">
				<CardContent className="space-y-4">
					{state.kind === "idle" || state.kind === "loading" ? (
						<>
							<div className="flex items-start gap-3">
								<ShieldCheck className="text-muted-foreground mt-0.5 size-4 shrink-0" />
								<p className="text-muted-foreground text-sm">
									This runs once after deploying a new instance. It creates a
									break-glass account (login:{" "}
									<span className="font-mono text-xs">intendant</span>) whose
									password is shown only at creation time — store it somewhere
									safe.
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
									? "Creating account…"
									: "Create recovery account"}
							</Button>
						</>
					) : null}

					{state.kind === "created" ? (
						<div className="space-y-4">
							<Alert tone="success" title="Recovery account created">
								<p>
									Copy these credentials now — the password cannot be shown
									again.
								</p>
							</Alert>
							<div className="space-y-2">
								<label className="text-sm font-medium" htmlFor="bootstrap-login">
									Login identifier
								</label>
								<Input id="bootstrap-login" value={INTENDANT_LOGIN} readOnly />
							</div>
							<div className="space-y-2">
								<label
									className="text-sm font-medium"
									htmlFor="bootstrap-password"
								>
									Password
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
										{copied ? "Copied" : "Copy"}
									</Button>
								</div>
							</div>
							<Button asChild className="w-full">
								<Link to="/login">Continue to sign in</Link>
							</Button>
						</div>
					) : null}

					{state.kind === "exists" ? (
						<div className="space-y-4">
							<Alert tone="info" title="Already set up">
								<p>
									This instance already has a recovery account. Sign in with it,
									or regenerate its password from settings after signing in.
								</p>
							</Alert>
							<Button asChild className="w-full" variant="outline">
								<Link to="/login">Go to sign in</Link>
							</Button>
						</div>
					) : null}

					{state.kind === "error" ? (
						<div className="space-y-4">
							<Alert tone="destructive" title="Setup failed">
								<p>{state.message}</p>
							</Alert>
							<Button className="w-full" onClick={handleBootstrap}>
								Try again
							</Button>
						</div>
					) : null}
				</CardContent>
			</Card>
		</AuthPageShell>
	);
}
