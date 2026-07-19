import { Download } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/api/errors";
import {
	fetchSystemTemplateContent,
	fetchTemplateContent,
	type SystemEmailTemplateKey,
} from "@/lib/email-templates/api";
import {
	downloadTextFile,
	htmlDownloadFilename,
} from "@/lib/email-templates/download";

type ComposeTemplateDownloadButtonProps = {
	templateId: string;
	templateName: string;
	/** Compose mailbox context; omit for management. */
	mailboxId?: string | null;
};

export function ComposeTemplateDownloadButton({
	templateId,
	templateName,
	mailboxId,
}: ComposeTemplateDownloadButtonProps) {
	const { t } = useTranslation("management");
	const { t: tc } = useTranslation("common");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const onDownload = async () => {
		setPending(true);
		setError(null);
		try {
			const html = await fetchTemplateContent(
				templateId,
				mailboxId ?? undefined,
			);
			downloadTextFile(htmlDownloadFilename(templateName), html);
		} catch (err) {
			setError(getErrorMessage(err));
		} finally {
			setPending(false);
		}
	};

	return (
		<>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="gap-1.5"
				disabled={pending}
				aria-label={t("templates.downloadAria", { name: templateName })}
				title={
					error ?? t("templates.downloadAria", { name: templateName })
				}
				onClick={() => void onDownload()}
			>
				<Download className="size-3.5" aria-hidden />
				{pending ? t("templates.downloading") : tc("download")}
			</Button>
			{error ? (
				<span className="text-destructive sr-only" role="alert">
					{error}
				</span>
			) : null}
		</>
	);
}

type SystemTemplateDownloadButtonProps = {
	templateKey: SystemEmailTemplateKey;
	templateLabel: string;
	disabled?: boolean;
};

export function SystemTemplateDownloadButton({
	templateKey,
	templateLabel,
	disabled = false,
}: SystemTemplateDownloadButtonProps) {
	const { t } = useTranslation("management");
	const { t: tc } = useTranslation("common");
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const onDownload = async () => {
		setPending(true);
		setError(null);
		try {
			const html = await fetchSystemTemplateContent(templateKey);
			downloadTextFile(htmlDownloadFilename(templateKey, templateKey), html);
		} catch (err) {
			setError(getErrorMessage(err));
		} finally {
			setPending(false);
		}
	};

	return (
		<>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="gap-1.5"
				disabled={disabled || pending}
				aria-label={t("templates.downloadAria", { name: templateLabel })}
				title={
					error ?? t("templates.downloadAria", { name: templateLabel })
				}
				onClick={() => void onDownload()}
			>
				<Download className="size-3.5" aria-hidden />
				{pending ? t("templates.downloading") : tc("download")}
			</Button>
			{error ? (
				<span className="text-destructive sr-only" role="alert">
					{error}
				</span>
			) : null}
		</>
	);
}
