import type { ThreadFolder } from "@/lib/api/client";

type ThreadRouteOptions = {
	folder?: ThreadFolder;
	labelId?: string | null;
	messageId?: string | null;
	q?: string | null;
};

export function labelListPath(mailboxId: string, labelId: string): string {
	return `/m/${mailboxId}/labels/${labelId}`;
}

export function threadPath(
	mailboxId: string,
	threadId: string,
	options?: ThreadRouteOptions,
): string {
	const search = new URLSearchParams();
	if (options?.messageId) {
		search.set("messageId", options.messageId);
	}
	if (options?.q) {
		search.set("q", options.q);
	}

	if (options?.labelId) {
		const query = search.toString();
		const base = `/m/${mailboxId}/labels/${options.labelId}/threads/${threadId}`;
		return query ? `${base}?${query}` : base;
	}

	const folder = options?.folder ?? "inbox";
	search.set("folder", folder);
	return `/m/${mailboxId}/threads/${threadId}?${search.toString()}`;
}

export function composePath(
	mailboxId: string,
	params: Record<string, string | undefined>,
): string {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value) {
			search.set(key, value);
		}
	}
	const query = search.toString();
	return query ? `/m/${mailboxId}/compose?${query}` : `/m/${mailboxId}/compose`;
}
