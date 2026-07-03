import type { ThreadFolder } from "@/lib/api/client";

type ThreadRouteOptions = {
	folder?: ThreadFolder;
	labelId?: string | null;
};

export function labelListPath(mailboxId: string, labelId: string): string {
	return `/m/${mailboxId}/labels/${labelId}`;
}

export function threadPath(
	mailboxId: string,
	threadId: string,
	options?: ThreadRouteOptions,
): string {
	if (options?.labelId) {
		return `/m/${mailboxId}/labels/${options.labelId}/threads/${threadId}`;
	}

	const folder = options?.folder ?? "inbox";
	return `/m/${mailboxId}/threads/${threadId}?folder=${folder}`;
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
