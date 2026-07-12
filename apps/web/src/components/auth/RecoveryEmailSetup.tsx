import { useState } from "react";
import { Loader2 } from "lucide-react";

import { AuthCodeInput, isAuthCodeComplete } from "@/components/auth/AuthCodeInput";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/api/errors";
import {
	sendRecoveryEmailCode,
	verifyRecoveryEmail,
} from "@/lib/auth/api";

type RecoveryEmailSetupProps = {
	initialEmail?: string;
	disabled?: boolean;
	onComplete?: () => void;
	onSkip?: () => void;
	showSkip?: boolean;
	submitLabel?: string;
};

export function RecoveryEmailSetup({
	initialEmail = "",
	disabled = false,
	onComplete,
	onSkip,
	showSkip = true,
	submitLabel = "Verify recovery email",
}: RecoveryEmailSetupProps) {
	const [email, setEmail] = useState(initialEmail);
	const [code, setCode] = useState("");
	const [codeSent, setCodeSent] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const canSendCode = email.trim().length > 0 && !submitting && !disabled;
	const canVerify =
		codeSent && isAuthCodeComplete(code) && !submitting && !disabled;

	const handleSendCode = async () => {
		setError(null);
		setSubmitting(true);
		try {
			await sendRecoveryEmailCode(email.trim());
			setCodeSent(true);
			setCode("");
		} catch (sendError) {
			setError(getErrorMessage(sendError));
		} finally {
			setSubmitting(false);
		}
	};

	const handleVerify = async () => {
		setError(null);
		setSubmitting(true);
		try {
			await verifyRecoveryEmail({
				email: email.trim(),
				code: code.trim(),
			});
			onComplete?.();
		} catch (verifyError) {
			setError(getErrorMessage(verifyError));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<label htmlFor="recovery-email" className="text-sm font-medium">
					Recovery email
				</label>
				<Input
					id="recovery-email"
					type="email"
					autoComplete="email"
					value={email}
					onChange={(event) => {
						setEmail(event.target.value);
						setCodeSent(false);
						setCode("");
					}}
					disabled={submitting || disabled || codeSent}
					placeholder="you@personal-email.com"
				/>
				<p className="text-muted-foreground text-xs">
					We'll send a verification code to this address. You can use it to recover
					your account if you forget your password or need to disable 2FA.
				</p>
			</div>

			{codeSent ? (
				<div className="space-y-2">
					<label htmlFor="recovery-code" className="text-sm font-medium">
						Verification code
					</label>
					<AuthCodeInput
						id="recovery-code"
						value={code}
						onChange={setCode}
						disabled={submitting || disabled}
						autoFocus
						invalid={Boolean(error)}
					/>
					<p className="text-muted-foreground text-xs">
						Enter the code we sent to your recovery email.
					</p>
				</div>
			) : null}

			{error ? <Alert tone="destructive">{error}</Alert> : null}

			<div className="flex flex-col gap-2">
				{codeSent ? (
					<Button
						type="button"
						className="w-full"
						onClick={handleVerify}
						disabled={!canVerify}
					>
						{submitting ? (
							<Loader2 className="size-4 animate-spin" aria-hidden />
						) : null}
						{submitting ? "Verifying…" : submitLabel}
					</Button>
				) : (
					<Button
						type="button"
						className="w-full"
						onClick={handleSendCode}
						disabled={!canSendCode}
					>
						{submitting ? (
							<Loader2 className="size-4 animate-spin" aria-hidden />
						) : null}
						{submitting ? "Sending…" : "Send verification code"}
					</Button>
				)}
				{codeSent ? (
					<Button
						type="button"
						variant="ghost"
						className="w-full"
						onClick={() => {
							setCodeSent(false);
							setCode("");
							setError(null);
						}}
						disabled={submitting || disabled}
					>
						Use a different email
					</Button>
				) : null}
				{showSkip ? (
					<Button
						type="button"
						variant="ghost"
						className="w-full"
						onClick={onSkip}
						disabled={submitting || disabled}
					>
						Skip for now
					</Button>
				) : null}
			</div>
		</div>
	);
}
