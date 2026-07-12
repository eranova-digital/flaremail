import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getErrorMessage } from "@/lib/api/errors";
import { formatAuthCode } from "@/lib/format-auth-code";

export function ResetPasswordPage() {
	const { resetPassword } = useAuth();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();

	const [code, setCode] = useState(() =>
		formatAuthCode(searchParams.get("code") ?? ""),
	);
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
			description="Enter the reset code you received and choose a new password."
		>
			<Card className="rounded-xl py-6 shadow-sm">
				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<label htmlFor="code" className="text-sm font-medium">
								Reset code
							</label>
							<Input
								id="code"
								autoComplete="one-time-code"
								autoFocus={!code}
								placeholder="XXXX-XXXX"
								className="font-mono tracking-wider uppercase"
								value={code}
								onChange={(event) => setCode(formatAuthCode(event.target.value))}
								disabled={submitting}
								required
							/>
							<p className="text-muted-foreground text-xs">
								Codes look like <span className="font-mono">AB2C-D4EF</span> and
								expire after a short time.
							</p>
						</div>
						<div className="space-y-2">
							<label htmlFor="password" className="text-sm font-medium">
								New password
							</label>
							<PasswordInput
								id="password"
								autoComplete="new-password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								disabled={submitting}
								required
							/>
							<p className="text-muted-foreground text-xs">
								Use a long, unique password you don't use anywhere else.
							</p>
						</div>
						{error ? <Alert tone="destructive">{error}</Alert> : null}
						<Button
							type="submit"
							className="w-full"
							disabled={submitting || !code.trim() || !password}
						>
							{submitting ? (
								<Loader2 className="size-4 animate-spin" aria-hidden />
							) : null}
							{submitting ? "Resetting…" : "Reset password"}
						</Button>
					</form>
				</CardContent>
			</Card>
			<p className="text-muted-foreground text-center text-sm">
				Remembered it after all?{" "}
				<Link to="/login" className="text-primary font-medium hover:underline">
					Back to sign in
				</Link>
			</p>
		</AuthPageShell>
	);
}
