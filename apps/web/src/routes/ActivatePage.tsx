import { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getErrorMessage } from "@/lib/api/errors";

function getPostActivatePath(account: { isIntendant: boolean }): string {
	return account.isIntendant ? "/settings" : "/";
}

export function ActivatePage() {
	const { isAuthenticated, isLoading, account, activate } = useAuth();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	const [code, setCode] = useState(searchParams.get("code") ?? "");
	const [password, setPassword] = useState("");
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	if (isLoading) {
		return (
			<div className="flex min-h-svh items-center justify-center p-8">
				<Skeleton className="h-8 w-48" />
			</div>
		);
	}

	if (isAuthenticated && account) {
		return <Navigate to={getPostActivatePath(account)} replace />;
	}

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError(null);
		setSubmitting(true);

		try {
			const me = await activate({
				code: code.trim(),
				password,
				firstName: firstName.trim() || undefined,
				lastName: lastName.trim() || undefined,
			});
			navigate(getPostActivatePath(me), { replace: true });
		} catch (submitError) {
			setError(getErrorMessage(submitError));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<AuthPageShell
			title="Activate account"
			description="Enter your invite code and choose a password."
		>
			<Card className="rounded-md py-6">
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<label htmlFor="code" className="text-sm font-medium">
								Invite code
							</label>
							<Input
								id="code"
								autoComplete="one-time-code"
								value={code}
								onChange={(event) => setCode(event.target.value)}
								disabled={submitting}
								required
							/>
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<label htmlFor="firstName" className="text-sm font-medium">
									First name
								</label>
								<Input
									id="firstName"
									autoComplete="given-name"
									value={firstName}
									onChange={(event) => setFirstName(event.target.value)}
									disabled={submitting}
								/>
							</div>
							<div className="space-y-2">
								<label htmlFor="lastName" className="text-sm font-medium">
									Last name
								</label>
								<Input
									id="lastName"
									autoComplete="family-name"
									value={lastName}
									onChange={(event) => setLastName(event.target.value)}
									disabled={submitting}
								/>
							</div>
						</div>
						<div className="space-y-2">
							<label htmlFor="password" className="text-sm font-medium">
								Password
							</label>
							<Input
								id="password"
								type="password"
								autoComplete="new-password"
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
							disabled={submitting || !code.trim() || !password}
						>
							Activate account
						</Button>
					</form>
				</CardContent>
			</Card>
			<p className="text-muted-foreground text-center text-sm">
				Already activated?{" "}
				<Link to="/login" className="text-primary hover:underline">
					Sign in
				</Link>
			</p>
		</AuthPageShell>
	);
}
