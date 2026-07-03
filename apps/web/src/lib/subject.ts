const SUBJECT_PREFIX_PATTERN = /^(re|fw|fwd):\s*/i;

export function normalizeSubjectForComparison(
	subject?: string | null,
): string {
	let normalized = subject?.trim() ?? "";

	while (SUBJECT_PREFIX_PATTERN.test(normalized)) {
		normalized = normalized.replace(SUBJECT_PREFIX_PATTERN, "").trim();
	}

	return normalized;
}

export function isSubjectChange(
	previousSubject?: string | null,
	currentSubject?: string | null,
): boolean {
	return (
		normalizeSubjectForComparison(previousSubject) !==
		normalizeSubjectForComparison(currentSubject)
	);
}

export function formatSubjectForDisplay(subject?: string | null): string {
	const trimmed = subject?.trim();
	return trimmed || "(no subject)";
}
