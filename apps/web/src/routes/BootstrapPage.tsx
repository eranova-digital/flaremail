import { useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
		return (
			<div className="flex min-h-svh items-center justify-center p-8">
				<Skeleton className="h-8 w-48" />
			</div>
		);
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
			title="Bootstrap Flaremail"
			description="Create the intendant break-glass account for this instance."
		>
			<Card className="rounded-md py-6">
				<CardContent className="space-y-4">
					{state.kind === "idle" ? (
						<>
							<p className="text-muted-foreground text-sm">
								Run this once after deploying a new instance. The intendant
								password is shown only at creation time.
							</p>
							<Button className="w-full" onClick={handleBootstrap}>
								Create intendant account
							</Button>
						</>
					) : null}

					{state.kind === "loading" ? (
						<div className="space-y-3">
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
						</div>
					) : null}

					{state.kind === "created" ? (
						<div className="space-y-4">
							<div className="bg-muted rounded-md px-4 py-3 text-sm">
								<p className="font-medium">Intendant account created</p>
								<p className="text-muted-foreground mt-1">
									Copy these credentials now. The password cannot be retrieved
									again.
								</p>
							</div>
							<div className="space-y-2">
								<label className="text-sm font-medium">Login identifier</label>
								<Input value={INTENDANT_LOGIN} readOnly />
							</div>
							<div className="space-y-2">
								<label className="text-sm font-medium">Password</label>
								<div className="flex gap-2">
									<Input
										value={state.password}
										readOnly
										className="font-mono text-sm"
									/>
									<Button
										type="button"
										variant="outline"
										onClick={handleCopyPassword}
									>
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
							<div className="bg-muted rounded-md px-4 py-3 text-sm">
								<p className="font-medium">Already bootstrapped</p>
								<p className="text-muted-foreground mt-1">
									This instance already has an intendant account. Use sign in, or
									regenerate the password from settings after signing in.
								</p>
							</div>
							<Button asChild className="w-full" variant="outline">
								<Link to="/login">Go to sign in</Link>
							</Button>
						</div>
					) : null}

					{state.kind === "error" ? (
						<div className="space-y-4">
							<p className="text-destructive text-sm">{state.message}</p>
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
