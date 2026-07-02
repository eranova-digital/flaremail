export function forwardSubject(parentSubject: string | null | undefined): string {
	const subject = parentSubject?.trim() ?? "";
	if (!subject) {
		return "Fwd:";
	}

	if (/^(fw|fwd):/i.test(subject)) {
		return subject;
	}

	return `Fwd: ${subject}`;
}
