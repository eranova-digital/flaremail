export type ReplyQuoteParent = {
	from: string;
	text?: string | null;
	html?: string | null;
	preview?: string | null;
	sentAt?: string | null;
	receivedAt?: string | null;
};

export type ReplyQuoteContent = {
	attribution: string;
	quotedText: string;
};

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function quoteLines(text: string): string {
	return text
		.split("\n")
		.map((line) => (line.length > 0 ? `> ${line}` : ">"))
		.join("\n");
}

export function formatReplyAttribution(from: string, when: Date): string {
	const day = when.toLocaleDateString("en-GB", { weekday: "short" });
	const date = when.toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
	const time = when.toLocaleTimeString("en-GB", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
	const fromPart = from.includes("<") ? from : `<${from}>`;

	return `On ${day}, ${date} at ${time}, ${fromPart} wrote:`;
}

export function formatReplyQuotePlainText({
	attribution,
	quotedText,
}: ReplyQuoteContent): string {
	return `${attribution}\n${quoteLines(quotedText)}`;
}

function paragraphHtml(text: string): string {
	const inner = text
		.split("\n")
		.map((line) => escapeHtml(line))
		.join("<br>");
	return `<p>${inner}</p>`;
}

export function buildReplyQuoteHtml({
	attribution,
	quotedText,
}: ReplyQuoteContent): string {
	const paragraphs = [paragraphHtml(attribution)];

	for (const block of quotedText.split(/\n\n+/)) {
		const trimmed = block.trim();
		if (trimmed) {
			paragraphs.push(paragraphHtml(trimmed));
		}
	}

	return `<blockquote type="cite" class="quote">${paragraphs.join("")}</blockquote>`;
}
