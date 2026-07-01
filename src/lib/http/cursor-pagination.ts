export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;

export type CursorPayload = {
	sortAt: string;
	id: string;
};

export type PaginatedResult<T> = {
	items: T[];
	nextCursor: string | null;
};

export function parseLimit(value: string | null): number {
	const parsed = Number(value ?? DEFAULT_LIMIT);
	if (!Number.isFinite(parsed)) {
		return DEFAULT_LIMIT;
	}

	return Math.min(Math.max(1, Math.floor(parsed)), MAX_LIMIT);
}

export function encodeCursor(payload: CursorPayload): string {
	return btoa(JSON.stringify(payload));
}

export function decodeCursor(cursor: string | null): CursorPayload | null {
	if (!cursor) {
		return null;
	}

	try {
		const parsed = JSON.parse(atob(cursor)) as CursorPayload;
		if (typeof parsed.sortAt !== "string" || typeof parsed.id !== "string") {
			return null;
		}

		return parsed;
	} catch {
		return null;
	}
}

export function buildNextCursor<T extends { sortAt: Date; id: string }>(
	items: T[],
	limit: number,
): string | null {
	if (items.length < limit) {
		return null;
	}

	const last = items[items.length - 1];
	return encodeCursor({
		sortAt: last.sortAt.toISOString(),
		id: last.id,
	});
}
