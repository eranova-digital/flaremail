import { useState } from "react";
import { Fingerprint, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { registerPasskey } from "@/lib/auth/passkeys";
import { getErrorMessage } from "@/lib/api/errors";

type PasskeyReminderDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onDismiss: () => void;
	onPasskeyAdded: () => void;
};

export function PasskeyReminderDialog({
	open,
	onOpenChange,
	onDismiss,
	onPasskeyAdded,
}: PasskeyReminderDialogProps) {
	const { t } = useTranslation("auth");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleDismiss = () => {
		if (submitting) {
			return;
		}
		setError(null);
		onDismiss();
	};

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			handleDismiss();
			return;
		}
		onOpenChange(next);
	};

	const handleAddPasskey = async () => {
		setError(null);
		setSubmitting(true);
		try {
			await registerPasskey();
			onPasskeyAdded();
		} catch (addError) {
			setError(getErrorMessage(addError));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Fingerprint className="text-primary size-5" aria-hidden />
						{t("passkeyReminder.title")}
					</DialogTitle>
					<DialogDescription asChild>
						<div className="text-muted-foreground space-y-2 text-sm">
							<p>{t("passkeyReminder.body")}</p>
							<p>
								{t("passkeyReminder.managePrefix")}{" "}
								<Link
									to="/settings?tab=security"
									className="text-foreground font-medium underline-offset-4 hover:underline"
									onClick={handleDismiss}
								>
									{t("passkeyReminder.settingsSecurity")}
								</Link>
								.
							</p>
						</div>
					</DialogDescription>
				</DialogHeader>
				{error ? <Alert tone="destructive">{error}</Alert> : null}
				<DialogFooter>
					<Button
						variant="outline"
						onClick={handleDismiss}
						disabled={submitting}
					>
						{t("passkeyReminder.notNow")}
					</Button>
					<Button onClick={() => void handleAddPasskey()} disabled={submitting}>
						{submitting ? (
							<Loader2 className="size-4 animate-spin" aria-hidden />
						) : (
							<Fingerprint className="size-4" aria-hidden />
						)}
						{t("passkeyReminder.addPasskey")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
