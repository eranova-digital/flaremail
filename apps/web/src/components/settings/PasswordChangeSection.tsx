import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrengthHints } from "@/components/auth/PasswordStrengthHints";
import { TotpCodeInput, isTotpCodeComplete } from "@/components/auth/TotpCodeInput";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { changePassword } from "@/lib/auth/api";
import { getErrorMessage } from "@/lib/api/errors";
import { isStrongPassword } from "@/lib/password-strength";

type PasswordChangeSectionProps = {
	mfaEnabled: boolean;
	onChanged?: () => void;
};

export function PasswordChangeSection({
	mfaEnabled,
	onChanged,
}: PasswordChangeSectionProps) {
	const { t } = useTranslation("settings");
	const { t: ta } = useTranslation("auth");
	const { t: te } = useTranslation("errors");
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [code, setCode] = useState("");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	const passwordsMatch = newPassword === confirmPassword;
	const passwordStrong = isStrongPassword(newPassword);
	const totpReady = !mfaEnabled || isTotpCodeComplete(code);
	const canSubmit =
		Boolean(currentPassword) &&
		Boolean(newPassword) &&
		Boolean(confirmPassword) &&
		passwordsMatch &&
		passwordStrong &&
		newPassword !== currentPassword &&
		totpReady &&
		!pending;

	const resetForm = () => {
		setCurrentPassword("");
		setNewPassword("");
		setConfirmPassword("");
		setCode("");
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!canSubmit) {
			return;
		}
		if (!passwordsMatch) {
			setError(ta("passwordsDoNotMatch"));
			setSuccess(false);
			return;
		}
		if (!passwordStrong) {
			setError(ta("passwordTooWeak"));
			setSuccess(false);
			return;
		}
		setPending(true);
		setError(null);
		setSuccess(false);
		try {
			await changePassword({
				currentPassword,
				newPassword,
				code: mfaEnabled ? code : undefined,
			});
			resetForm();
			setSuccess(true);
			onChanged?.();
		} catch (err) {
			setError(getErrorMessage(err));
		} finally {
			setPending(false);
		}
	};

	return (
		<Card className="rounded-xl shadow-sm">
			<CardHeader className="pb-4">
				<CardTitle className="flex items-center gap-2 text-base">
					<KeyRound className="text-muted-foreground size-4" aria-hidden />
					{t("changePassword.title")}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
					<p className="text-muted-foreground text-sm">
						{t("changePassword.description")}
					</p>
					{error ? <Alert tone="destructive">{error}</Alert> : null}
					{success ? (
						<Alert tone="success">{t("changePassword.success")}</Alert>
					) : null}
					<div className="grid gap-3 sm:max-w-sm">
						<div className="space-y-2">
							<label htmlFor="change-current-password" className="text-sm font-medium">
								{t("changePassword.currentPassword")}
							</label>
							<PasswordInput
								id="change-current-password"
								autoComplete="current-password"
								value={currentPassword}
								onChange={(event) => {
									setCurrentPassword(event.target.value);
									setSuccess(false);
								}}
								disabled={pending}
							/>
						</div>
						<div className="space-y-2">
							<label htmlFor="change-new-password" className="text-sm font-medium">
								{t("changePassword.newPassword")}
							</label>
							<PasswordInput
								id="change-new-password"
								autoComplete="new-password"
								value={newPassword}
								onChange={(event) => {
									setNewPassword(event.target.value);
									setSuccess(false);
								}}
								disabled={pending}
								aria-invalid={Boolean(newPassword) && !passwordStrong}
							/>
							<PasswordStrengthHints password={newPassword} />
						</div>
						<div className="space-y-2">
							<label
								htmlFor="change-confirm-password"
								className="text-sm font-medium"
							>
								{t("changePassword.confirmPassword")}
							</label>
							<PasswordInput
								id="change-confirm-password"
								autoComplete="new-password"
								value={confirmPassword}
								onChange={(event) => {
									setConfirmPassword(event.target.value);
									setSuccess(false);
								}}
								disabled={pending}
								aria-invalid={
									Boolean(confirmPassword) && !passwordsMatch
								}
							/>
							{confirmPassword && !passwordsMatch ? (
								<p className="text-destructive text-xs">
									{ta("passwordsDoNotMatch")}
								</p>
							) : null}
							{newPassword && newPassword === currentPassword ? (
								<p className="text-destructive text-xs">
									{te("new-password-must-differ")}
								</p>
							) : null}
						</div>
						{mfaEnabled ? (
							<div className="space-y-2">
								<label
									htmlFor="change-password-code"
									className="text-sm font-medium"
								>
									{t("changePassword.authenticatorCode")}
								</label>
								<p className="text-muted-foreground text-xs">
									{t("changePassword.mfaHint")}
								</p>
								<TotpCodeInput
									id="change-password-code"
									value={code}
									onChange={setCode}
									disabled={pending}
									invalid={Boolean(error)}
								/>
							</div>
						) : null}
					</div>
					<Button type="submit" disabled={!canSubmit}>
						{pending ? (
							<Loader2 className="size-4 animate-spin" aria-hidden />
						) : null}
						{pending
							? t("changePassword.changing")
							: t("changePassword.submit")}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
