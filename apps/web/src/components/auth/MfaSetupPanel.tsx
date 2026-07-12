import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { TotpCodeInput, isTotpCodeComplete } from "@/components/auth/TotpCodeInput";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { confirmMfa, setupMfa } from "@/lib/auth/api";
import type { MfaSetup } from "@/lib/auth/types";
import { getErrorMessage } from "@/lib/api/errors";

type MfaSetupPanelProps = {
	onComplete?: () => void | Promise<void>;
	submitLabel?: string;
};

export function MfaSetupPanel({
	onComplete,
	submitLabel = "Enable two-factor authentication",
}: MfaSetupPanelProps) {
	const [setup, setSetup] = useState<MfaSetup | null>(null);
	const [confirmCode, setConfirmCode] = useState("");
	const [loadingSetup, setLoadingSetup] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		(async () => {
			setLoadingSetup(true);
			setError(null);
			try {
				const nextSetup = await setupMfa();
				if (!cancelled) {
					setSetup(nextSetup);
				}
			} catch (setupError) {
				if (!cancelled) {
					setError(getErrorMessage(setupError));
				}
			} finally {
				if (!cancelled) {
					setLoadingSetup(false);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	const handleConfirm = async (code = confirmCode) => {
		if (submitting || !isTotpCodeComplete(code)) {
			return;
		}

		setError(null);
		setSubmitting(true);
		try {
			await confirmMfa(code.trim());
			await onComplete?.();
		} catch (confirmError) {
			setError(getErrorMessage(confirmError));
		} finally {
			setSubmitting(false);
		}
	};


	if (loadingSetup) {
		return (
			<div className="text-muted-foreground flex items-center gap-2 text-sm">
				<Loader2 className="size-4 animate-spin" aria-hidden />
				Preparing authenticator setup…
			</div>
		);
	}

	if (!setup) {
		return error ? <Alert tone="destructive">{error}</Alert> : null;
	}

	return (
		<div className="space-y-4">
			<p className="text-sm">
				Scan this QR code with your authenticator app, then enter the 6-digit code
				to finish setup.
			</p>
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start">
				<div className="bg-background inline-flex rounded-lg border p-3">
					<QRCodeSVG value={setup.otpauthUrl} size={160} />
				</div>
				<div className="space-y-2 text-sm">
					<p className="font-medium">Can&apos;t scan the code?</p>
					<p className="text-muted-foreground">
						Enter this key manually in your authenticator app:
					</p>
					<code className="bg-muted block rounded px-2 py-1 font-mono text-xs break-all">
						{setup.secret}
					</code>
				</div>
			</div>
			<div className="grid gap-3 sm:max-w-xs">
				<div className="space-y-2">
					<label htmlFor="compliance-mfa-code" className="text-sm font-medium">
						Verification code
					</label>
					<TotpCodeInput
						id="compliance-mfa-code"
						value={confirmCode}
						onChange={setConfirmCode}
						onComplete={(value) => void handleConfirm(value)}
						disabled={submitting}
						autoFocus
						invalid={Boolean(error)}
					/>
				</div>
				{error ? <Alert tone="destructive">{error}</Alert> : null}
				<Button
					onClick={() => void handleConfirm()}
					disabled={submitting || !isTotpCodeComplete(confirmCode)}
				>
					{submitting ? (
						<Loader2 className="size-4 animate-spin" aria-hidden />
					) : null}
					{submitting ? "Enabling…" : submitLabel}
				</Button>
			</div>
		</div>
	);
}
