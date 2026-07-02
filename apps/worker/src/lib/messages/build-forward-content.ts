export function forwardSubject(parentSubject: string | null): string {
	const subject = parentSubject?.trim() ?? "";
	if (!subject) {
		return "Fwd:";
	}

	if (/^(fw|fwd):/i.test(subject)) {
		return subject;
	}

	return `Fwd: ${subject}`;
}

function formatForwardDate(value: Date): string {
	return value.toLocaleString("en-US", {
		weekday: "short",
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZoneName: "short",
	});
}

export function buildForwardQuotedText(parent: {
	from: string;
	subject: string | null;
	text: string | null;
	sentAt: Date | null;
	receivedAt: Date;
}): string {
	const when = parent.sentAt ?? parent.receivedAt;

	return [
		"---------- Forwarded message ----------",
		`From: ${parent.from}`,
		`Date: ${formatForwardDate(when)}`,
		`Subject: ${parent.subject ?? ""}`,
		"",
		parent.text?.trim() ?? "",
	].join("\n");
}

export function buildForwardBodyText(
	userText: string | undefined,
	quotedText: string,
): string {
	const intro = userText?.trim() ?? "";
	if (!intro) {
		return quotedText;
	}

	return `${intro}\n\n${quotedText}`;
}

export function buildForwardQuotedHtml(parent: {
	from: string;
	subject: string | null;
	html: string | null;
	text: string | null;
	sentAt: Date | null;
	receivedAt: Date;
}): string | null {
	const when = parent.sentAt ?? parent.receivedAt;
	const body = parent.html?.trim() || parent.text?.trim();
	if (!body) {
		return null;
	}

	const escapedFrom = escapeHtml(parent.from);
	const escapedSubject = escapeHtml(parent.subject ?? "");
	const escapedDate = escapeHtml(formatForwardDate(when));
	const bodyContent = parent.html?.trim()
		? parent.html
		: `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(parent.text ?? "")}</pre>`;

	return [
		'<div style="margin:1em 0">',
		"---------- Forwarded message ----------<br>",
		`From: ${escapedFrom}<br>`,
		`Date: ${escapedDate}<br>`,
		`Subject: ${escapedSubject}<br><br>`,
		bodyContent,
		"</div>",
	].join("");
}

export function buildForwardBodyHtml(
	userHtml: string | undefined,
	quotedHtml: string | null,
): string | undefined {
	if (userHtml?.trim() && quotedHtml) {
		return `${userHtml.trim()}<br><br>${quotedHtml}`;
	}

	if (userHtml?.trim()) {
		return userHtml.trim();
	}

	return quotedHtml ?? undefined;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}
