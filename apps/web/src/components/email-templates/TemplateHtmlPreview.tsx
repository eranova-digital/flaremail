import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type TemplateHtmlPreviewProps = {
	html: string | null | undefined;
	isLoading?: boolean;
	error?: string | null;
	emptyLabel?: string;
	className?: string;
};

/**
 * Build a standards-mode document so email layout tables (`border="0"` /
 * `role="presentation"`) do not pick up UA/quirks borders, while keeping
 * intentional inline borders (cards, code boxes, etc.).
 */
export function buildTemplatePreviewSrcDoc(html: string): string {
	const resetCss = [
		"html, body { margin: 0; padding: 8px; background: #ffffff; color: #0a0a0a; }",
		'table[role="presentation"], table[border="0"] { border: none !important; }',
		'table[role="presentation"] td:not([style*="border"]),',
		'table[role="presentation"] th:not([style*="border"]),',
		'table[border="0"] td:not([style*="border"]),',
		'table[border="0"] th:not([style*="border"]) { border: none !important; }',
	].join("\n");

	return [
		"<!DOCTYPE html>",
		"<html><head>",
		'<meta charset="utf-8" />',
		'<meta name="viewport" content="width=device-width, initial-scale=1" />',
		`<style>${resetCss}</style>`,
		"</head><body>",
		html,
		"</body></html>",
	].join("");
}

/** Renders template HTML in a sandboxed iframe (no scripts). */
export function TemplateHtmlPreview({
	html,
	isLoading = false,
	error = null,
	emptyLabel,
	className,
}: TemplateHtmlPreviewProps) {
	const { t } = useTranslation("management");
	const resolvedEmptyLabel = emptyLabel ?? t("templates.previewEmpty");
	const srcDoc = useMemo(
		() => (html?.trim() ? buildTemplatePreviewSrcDoc(html) : null),
		[html],
	);

	if (isLoading) {
		return (
			<div className={cn("space-y-2 p-3", className)}>
				<Skeleton className="h-4 w-2/3" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-5/6" />
				<Skeleton className="h-24 w-full" />
			</div>
		);
	}

	if (error) {
		return (
			<p className={cn("text-destructive p-3 text-xs", className)}>{error}</p>
		);
	}

	if (!srcDoc) {
		return (
			<p className={cn("text-muted-foreground p-3 text-xs", className)}>
				{resolvedEmptyLabel}
			</p>
		);
	}

	return (
		<iframe
			title={t("templates.previewIframeTitle")}
			sandbox=""
			srcDoc={srcDoc}
			className={cn("bg-background h-full w-full border-0", className)}
		/>
	);
}

export function useTemplateHtml(
	queryKey: readonly unknown[],
	fetcher: () => Promise<string>,
	enabled: boolean,
) {
	return useQuery({
		queryKey,
		queryFn: fetcher,
		enabled,
		staleTime: 60_000,
	});
}
