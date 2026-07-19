import { useState } from "react";
import { Check, Copy, KeyRound, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { TotpCodeInput, isTotpCodeComplete } from "@/components/auth/TotpCodeInput";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { regenerateIntendantPassword } from "@/lib/auth/api";
import { getErrorMessage } from "@/lib/api/errors";

type IntendantPasswordSectionProps = {
	mfaEnabled: boolean;
};

export function IntendantPasswordSection({
	mfaEnabled,
}: IntendantPasswordSectionProps) {
	const { t } = useTranslation("settings");
	const { t: tc } = useTranslation("common");
	const [open, setOpen] = useState(false);
	const [code, setCode] = useState("");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [password, setPassword] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	const resetDialog = () => {
		setCode("");
		setError(null);
		setPassword(null);
		setCopied(false);
		setPending(false);
	};

	const handleOpenChange = (next: boolean) => {
		if (pending) {
			return;
		}
		setOpen(next);
		if (!next) {
			resetDialog();
		}
	};

	const handleRegenerate = async () => {
		if (mfaEnabled && !isTotpCodeComplete(code)) {
			return;
		}
		setPending(true);
		setError(null);
		try {
			const result = await regenerateIntendantPassword(
				mfaEnabled ? { code } : {},
			);
			setPassword(result.password);
			setCode("");
		} catch (err) {
			setError(getErrorMessage(err));
		} finally {
			setPending(false);
		}
	};

	const handleCopy = async () => {
		if (!password) {
			return;
		}
		try {
			await navigator.clipboard.writeText(password);
			setCopied(true);
		} catch {
			setCopied(false);
		}
	};

	return (
		<>
			<Card className="rounded-xl shadow-sm">
				<CardHeader className="pb-4">
					<CardTitle className="flex items-center gap-2 text-base">
						<KeyRound className="text-muted-foreground size-4" aria-hidden />
						{t("intendantPassword.title")}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-muted-foreground text-sm">
						{t("intendantPassword.description")}
					</p>
					<Button variant="outline" onClick={() => setOpen(true)}>
						{t("intendantPassword.regenerate")}
					</Button>
				</CardContent>
			</Card>

			<Dialog open={open} onOpenChange={handleOpenChange}>
				<DialogContent className="sm:max-w-md">
					{password ? (
						<>
							<DialogHeader>
								<DialogTitle>{t("intendantPassword.newTitle")}</DialogTitle>
								<DialogDescription asChild>
									<div className="text-muted-foreground space-y-1 text-sm">
										<p>{t("intendantPassword.newBody")}</p>
									</div>
								</DialogDescription>
							</DialogHeader>
							<Alert
								tone="success"
								title={t("intendantPassword.rotatedTitle")}
							>
								<p>{t("intendantPassword.rotatedBody")}</p>
							</Alert>
							<div className="space-y-2">
								<label
									htmlFor="intendant-new-password"
									className="text-sm font-medium"
								>
									{t("intendantPassword.newPasswordLabel")}
								</label>
								<div className="flex gap-2">
									<Input
										id="intendant-new-password"
										value={password}
										readOnly
										className="font-mono text-xs"
									/>
									<Button
										type="button"
										variant="outline"
										size="icon"
										onClick={() => void handleCopy()}
										aria-label={
											copied
												? tc("copied")
												: t("intendantPassword.copyAria")
										}
									>
										{copied ? (
											<Check className="size-4" aria-hidden />
										) : (
											<Copy className="size-4" aria-hidden />
										)}
									</Button>
								</div>
							</div>
							<DialogFooter>
								<Button onClick={() => handleOpenChange(false)}>
									{t("intendantPassword.done")}
								</Button>
							</DialogFooter>
						</>
					) : (
						<>
							<DialogHeader>
								<DialogTitle>{t("intendantPassword.confirmTitle")}</DialogTitle>
								<DialogDescription asChild>
									<div className="text-muted-foreground space-y-1 text-sm">
										<p>{t("intendantPassword.confirmBody")}</p>
										{mfaEnabled ? (
											<p>{t("intendantPassword.confirmMfaHint")}</p>
										) : null}
									</div>
								</DialogDescription>
							</DialogHeader>
							{error ? <Alert tone="destructive">{error}</Alert> : null}
							{mfaEnabled ? (
								<div className="space-y-2">
									<label
										htmlFor="intendant-regenerate-code"
										className="text-sm font-medium"
									>
										{t("intendantPassword.authenticatorCode")}
									</label>
									<TotpCodeInput
										id="intendant-regenerate-code"
										value={code}
										onChange={setCode}
										onComplete={() => void handleRegenerate()}
										disabled={pending}
										autoFocus
										invalid={Boolean(error)}
									/>
								</div>
							) : null}
							<DialogFooter>
								<Button
									variant="outline"
									onClick={() => handleOpenChange(false)}
									disabled={pending}
								>
									{tc("cancel")}
								</Button>
								<Button
									variant="destructive"
									onClick={() => void handleRegenerate()}
									disabled={
										pending || (mfaEnabled && !isTotpCodeComplete(code))
									}
								>
									{pending ? (
										<Loader2 className="size-4 animate-spin" aria-hidden />
									) : null}
									{t("intendantPassword.regenerate")}
								</Button>
							</DialogFooter>
						</>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
