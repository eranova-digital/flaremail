import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";

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
	submitLabel,
}: MfaSetupPanelProps) {
	const { t } = useTranslation("auth");
	const resolvedSubmitLabel = submitLabel ?? t("mfaSetup.enable");
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
				{t("mfaSetup.preparing")}
			</div>
		);
	}

	if (!setup) {
		return error ? <Alert tone="destructive">{error}</Alert> : null;
	}

	return (
		<div className="space-y-4">
			<p className="text-sm">{t("mfaSetup.instructions")}</p>
			<div className="flex flex-col gap-4 sm:flex-row sm:items-start">
				<div className="inline-flex rounded-lg border bg-white p-3">
					<QRCodeSVG
						value={setup.otpauthUrl}
						size={160}
						bgColor="#FFFFFF"
						fgColor="#000000"
						includeMargin
					/>
				</div>
				<div className="space-y-2 text-sm">
					<p className="font-medium">{t("mfaSetup.cantScan")}</p>
					<p className="text-muted-foreground">{t("mfaSetup.manualKey")}</p>
					<code className="bg-muted block rounded px-2 py-1 font-mono text-xs break-all">
						{setup.secret}
					</code>
				</div>
			</div>
			<div className="grid gap-3 sm:max-w-xs">
				<div className="space-y-2">
					<label htmlFor="compliance-mfa-code" className="text-sm font-medium">
						{t("mfaSetup.codeLabel")}
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
					{submitting ? t("mfaSetup.enabling") : resolvedSubmitLabel}
				</Button>
			</div>
		</div>
	);
}
