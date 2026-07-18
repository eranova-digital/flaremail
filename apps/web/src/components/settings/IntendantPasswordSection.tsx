import { useState } from "react";
import { Check, Copy, KeyRound, Loader2 } from "lucide-react";

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
						Recovery account password
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-muted-foreground text-sm">
						The intendant password is randomly generated and never chosen by
						you. Regenerating replaces the current password immediately — store
						the new one somewhere safe.
					</p>
					<Button variant="outline" onClick={() => setOpen(true)}>
						Regenerate password
					</Button>
				</CardContent>
			</Card>

			<Dialog open={open} onOpenChange={handleOpenChange}>
				<DialogContent className="sm:max-w-md">
					{password ? (
						<>
							<DialogHeader>
								<DialogTitle>New password generated</DialogTitle>
								<DialogDescription asChild>
									<div className="text-muted-foreground space-y-1 text-sm">
										<p>
											Copy this password now. It will not be shown again after
											you close this dialog.
										</p>
									</div>
								</DialogDescription>
							</DialogHeader>
							<Alert tone="success" title="Password rotated">
								<p>The previous intendant password no longer works.</p>
							</Alert>
							<div className="space-y-2">
								<label
									htmlFor="intendant-new-password"
									className="text-sm font-medium"
								>
									New password
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
										aria-label={copied ? "Copied" : "Copy password"}
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
								<Button onClick={() => handleOpenChange(false)}>Done</Button>
							</DialogFooter>
						</>
					) : (
						<>
							<DialogHeader>
								<DialogTitle>Regenerate intendant password?</DialogTitle>
								<DialogDescription asChild>
									<div className="text-muted-foreground space-y-1 text-sm">
										<p>
											This immediately replaces the current password with a new
											random secret. You will need the new password the next
											time you sign in.
										</p>
										{mfaEnabled ? (
											<p>
												Enter a code from your authenticator app to confirm.
											</p>
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
										Authenticator code
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
									Cancel
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
									Regenerate password
								</Button>
							</DialogFooter>
						</>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
