import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

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
	submitLabel,
}: RecoveryEmailSetupProps) {
	const { t } = useTranslation("auth");
	const resolvedSubmitLabel = submitLabel ?? t("recoveryEmail.verify");
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
					{t("recoveryEmail.label")}
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
					placeholder={t("recoveryEmail.placeholder")}
				/>
				<p className="text-muted-foreground text-xs">{t("recoveryEmail.hint")}</p>
			</div>

			{codeSent ? (
				<div className="space-y-2">
					<label htmlFor="recovery-code" className="text-sm font-medium">
						{t("recoveryEmail.codeLabel")}
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
						{t("recoveryEmail.codeHint")}
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
						{submitting ? t("recoveryEmail.verifying") : resolvedSubmitLabel}
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
						{submitting ? t("recoveryEmail.sending") : t("recoveryEmail.sendCode")}
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
						{t("recoveryEmail.differentEmail")}
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
						{t("recoveryEmail.skip")}
					</Button>
				) : null}
			</div>
		</div>
	);
}
