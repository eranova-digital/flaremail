export function buildPreview(textBody: string | null | undefined): string | null {
	if (!textBody) {
		return null;
	}

	return textBody.slice(0, 200);
}

export function parseSentAt(
	dateHeader: string | null,
	parsedDate: string | undefined,
): Date | null {
	if (parsedDate) {
		const parsed = new Date(parsedDate);
		if (!Number.isNaN(parsed.getTime())) {
			return parsed;
		}
	}

	if (dateHeader) {
		const parsed = new Date(dateHeader);
		if (!Number.isNaN(parsed.getTime())) {
			return parsed;
		}
	}

	return null;
}
