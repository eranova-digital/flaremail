export const SUBJECT_PREFIX_PATTERN = /^(re|fw|fwd):\s*/i;

export function replySubject(parentSubject: string | null): string {
	const subject = parentSubject?.trim() ?? "";
	if (!subject) {
		return "Re:";
	}

	if (/^re:/i.test(subject)) {
		return subject;
	}

	return `Re: ${subject}`;
}

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

export function normalizeSubjectForComparison(
	subject?: string | null,
): string {
	let normalized = subject?.trim() ?? "";

	while (SUBJECT_PREFIX_PATTERN.test(normalized)) {
		normalized = normalized.replace(SUBJECT_PREFIX_PATTERN, "").trim();
	}

	return normalized;
}
