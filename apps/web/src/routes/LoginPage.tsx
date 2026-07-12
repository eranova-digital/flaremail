import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getErrorMessage } from "@/lib/api/errors";

function getPostLoginPath(
	account: { isIntendant: boolean } | null,
	from: string | undefined,
): string {
	if (account?.isIntendant) {
		return "/";
	}

	return from && from !== "/login" ? from : "/";
}

export function LoginPage() {
	const { account, isAuthenticated, isLoading, signIn } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const locationState = location.state as
		| { from?: string; success?: string }
		| null;
	const from = locationState?.from;
	const success = locationState?.success;

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const useTextEmailInput = email.trim().toLowerCase() === "intendant";
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	if (isLoading) {
		return (
			<div className="flex min-h-svh items-center justify-center p-8">
				<Skeleton className="h-8 w-48" />
			</div>
		);
	}

	if (isAuthenticated) {
		return <Navigate to={getPostLoginPath(account, from)} replace />;
	}

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError(null);
		setSubmitting(true);

		try {
			const me = await signIn(email.trim(), password);
			navigate(getPostLoginPath(me, from), { replace: true });
		} catch (submitError) {
			setError(getErrorMessage(submitError));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<AuthPageShell
			title="Sign in"
			description="Sign in to your Flaremail account."
		>
			<Card className="rounded-md py-6">
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<label htmlFor="email" className="text-sm font-medium">
								Email
							</label>
							<Input
								id="email"
								type={useTextEmailInput ? "text" : "email"}
								autoComplete="email"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								disabled={submitting}
								required
							/>
						</div>
						<div className="space-y-2">
							<label htmlFor="password" className="text-sm font-medium">
								Password
							</label>
							<Input
								id="password"
								type="password"
								autoComplete="current-password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								disabled={submitting}
								required
							/>
						</div>
						{error ? (
							<p className="text-destructive text-sm">{error}</p>
						) : null}
						<Button
							type="submit"
							className="w-full"
							disabled={submitting || !email.trim() || !password}
						>
							Sign in
						</Button>
						{success ? (
							<p className="text-muted-foreground text-sm" role="status">
								{success}
							</p>
						) : null}
					</form>
				</CardContent>
			</Card>
			<p className="text-muted-foreground text-center text-sm">
				<Link to="/reset-password" className="text-primary hover:underline">
					Forgot password?
				</Link>
			</p>
			<p className="text-muted-foreground text-center text-sm">
				Have an invite code?{" "}
				<Link to="/activate" className="text-primary hover:underline">
					Activate account
				</Link>
			</p>
		</AuthPageShell>
	);
}
