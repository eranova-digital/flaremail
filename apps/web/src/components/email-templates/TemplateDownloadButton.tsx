import { Download } from "lucide-react";
import { useState } from "react";

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
				aria-label={`Download ${templateName}`}
				title={error ?? `Download ${templateName}`}
				onClick={() => void onDownload()}
			>
				<Download className="size-3.5" aria-hidden />
				{pending ? "Downloading…" : "Download"}
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
				aria-label={`Download ${templateLabel}`}
				title={error ?? `Download ${templateLabel}`}
				onClick={() => void onDownload()}
			>
				<Download className="size-3.5" aria-hidden />
				{pending ? "Downloading…" : "Download"}
			</Button>
			{error ? (
				<span className="text-destructive sr-only" role="alert">
					{error}
				</span>
			) : null}
		</>
	);
}
