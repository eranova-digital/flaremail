import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PageLoader } from "@/components/PageLoader";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
		return <PageLoader label="Checking your session…" />;
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
			title="Welcome back"
			description="Sign in to your Flaremail account."
		>
			{success ? <Alert tone="success">{success}</Alert> : null}
			<Card className="rounded-xl py-6 shadow-sm">
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
								autoFocus
								placeholder="you@example.com"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								disabled={submitting}
								required
							/>
						</div>
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<label htmlFor="password" className="text-sm font-medium">
									Password
								</label>
								<Link
									to="/reset-password"
									className="text-muted-foreground hover:text-foreground text-xs font-medium transition-colors"
									tabIndex={-1}
								>
									Forgot password?
								</Link>
							</div>
							<PasswordInput
								id="password"
								autoComplete="current-password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								disabled={submitting}
								required
							/>
						</div>
						{error ? <Alert tone="destructive">{error}</Alert> : null}
						<Button
							type="submit"
							className="w-full"
							disabled={submitting || !email.trim() || !password}
						>
							{submitting ? (
								<Loader2 className="size-4 animate-spin" aria-hidden />
							) : null}
							{submitting ? "Signing in…" : "Sign in"}
						</Button>
					</form>
				</CardContent>
			</Card>
			<p className="text-muted-foreground text-center text-sm">
				Have an invite code?{" "}
				<Link
					to="/activate"
					className="text-primary font-medium hover:underline"
				>
					Activate your account
				</Link>
			</p>
		</AuthPageShell>
	);
}
