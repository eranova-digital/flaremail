import { normalizeSubjectForComparison } from "@test-worker/mail-quoting";

export { normalizeSubjectForComparison };

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
