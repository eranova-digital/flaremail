import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getErrorMessage } from "@/lib/api/errors";

export function ResetPasswordPage() {
	const { resetPassword } = useAuth();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	const [code, setCode] = useState(searchParams.get("code") ?? "");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError(null);
		setSubmitting(true);

		try {
			await resetPassword({ code: code.trim(), password });
			navigate("/login", {
				replace: true,
				state: { success: "Password reset. Sign in with your new password." },
			});
		} catch (submitError) {
			setError(getErrorMessage(submitError));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<AuthPageShell
			title="Reset password"
			description="Enter your reset code and choose a new password."
		>
			<Card className="rounded-md py-6">
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<label htmlFor="code" className="text-sm font-medium">
								Reset code
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
						<div className="space-y-2">
							<label htmlFor="password" className="text-sm font-medium">
								New password
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
							Reset password
						</Button>
					</form>
				</CardContent>
			</Card>
			<p className="text-muted-foreground text-center text-sm">
				<Link to="/login" className="text-primary hover:underline">
					Back to sign in
				</Link>
			</p>
		</AuthPageShell>
	);
}
