import { useEffect, useMemo, useState } from "react";

import { EmailHtmlBody } from "@/components/message/EmailHtmlBody";
import { MessageAttachments } from "@/components/message/MessageAttachments";
import { hydrateInlineImagesForDisplay } from "@/lib/email-html";
import {
	getPlainTextSource,
	parseReplyBody,
	splitQuotedHtml,
} from "@/lib/parse-reply-body";
import { cn } from "@/lib/utils";

type MessageBodyProps = {
	preview?: string | null;
	text?: string | null;
	html?: string | null;
	attachments?: Array<{
		id?: string;
		filename?: string | null;
		mimeType?: string;
		sizeBytes?: number;
		disposition?: string | null;
		contentId?: string | null;
	}>;
	direction?: "inbound" | "outbound";
};

export function MessageBody({
	preview,
	text,
	html,
	attachments,
	direction,
}: MessageBodyProps) {
	const [showQuote, setShowQuote] = useState(false);
	const [displayHtml, setDisplayHtml] = useState(html ?? "");

	useEffect(() => {
		if (!html) {
			setDisplayHtml("");
			return;
		}

		let cancelled = false;
		void hydrateInlineImagesForDisplay(html, attachments ?? []).then((next) => {
			if (!cancelled) {
				setDisplayHtml(next);
			}
		});

		return () => {
			cancelled = true;
		};
	}, [attachments, html]);

	const htmlQuote = useMemo(() => {
		const source = displayHtml || html;
		return source?.trim() ? splitQuotedHtml(source) : null;
	}, [displayHtml, html]);

	const plainSource = useMemo(
		() => getPlainTextSource(text, html, preview),
		[text, html, preview],
	);

	const parsedReply = useMemo(
		() => (plainSource ? parseReplyBody(plainSource) : null),
		[plainSource],
	);

	const hasHtml = Boolean(html?.trim());
	const hasQuotedReply = hasHtml
		? Boolean(htmlQuote?.quotedHtml)
		: (parsedReply?.hasQuotedReply ?? false);
	const quotedText = parsedReply?.quotedText.trim() ?? "";
	const quotedHtml = htmlQuote?.quotedHtml ?? null;
	const visibleHtml =
		htmlQuote?.visibleHtml ??
		(displayHtml.trim() ? displayHtml : html?.trim() ? html : "");

	if (!text && !html && !preview) {
		return (
			<pre className="text-muted-foreground text-sm whitespace-pre-wrap">
				(empty message)
			</pre>
		);
	}

	const bodyContent = hasHtml ? (
		<EmailHtmlBody html={visibleHtml} />
	) : hasQuotedReply && parsedReply ? (
		<pre className="text-sm whitespace-pre-wrap">
			{parsedReply.visibleText.trim() || "(empty message)"}
		</pre>
	) : (
		<pre className="text-sm whitespace-pre-wrap">
			{text || preview || "(empty message)"}
		</pre>
	);

	const showQuoteToggle = hasQuotedReply && (hasHtml ? Boolean(quotedHtml) : Boolean(quotedText));

	return (
		<>
			{bodyContent}
			{showQuoteToggle ? (
				<div className="mt-1">
					<button
						type="button"
						aria-label={showQuote ? "Hide quoted text" : "Show quoted text"}
						aria-expanded={showQuote}
						onClick={() => setShowQuote((prev) => !prev)}
						className={cn(
							"text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-5 items-center rounded-md border px-2 text-xs leading-none transition-colors",
							showQuote && "bg-muted text-foreground",
						)}
					>
						…
					</button>
					{showQuote ? (
						hasHtml && quotedHtml ? (
							<div className="text-muted-foreground mt-2 border-l-2 pl-3">
								<EmailHtmlBody html={quotedHtml} />
							</div>
						) : (
							<pre className="text-muted-foreground mt-2 border-l-2 pl-3 text-sm whitespace-pre-wrap">
								{quotedText}
							</pre>
						)
					) : null}
				</div>
			) : null}
			{attachments && attachments.length > 0 && direction ? (
				<MessageAttachments
					attachments={attachments.filter(
						(
							attachment,
						): attachment is {
							id: string;
							filename?: string | null;
							mimeType: string;
							sizeBytes: number;
						} =>
							Boolean(attachment.id && attachment.mimeType) &&
							attachment.disposition !== "inline",
					)}
					direction={direction}
				/>
			) : null}
		</>
	);
}
