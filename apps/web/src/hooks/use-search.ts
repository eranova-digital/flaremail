import { useQuery } from "@tanstack/react-query";
import { parseSearchQuery } from "@flaremail/mail-search-query";

import { searchMessages } from "@/lib/api/client";
import { assertData } from "@/lib/api/errors";
import { queryKeys } from "@/lib/query-keys";
import { THREADS_POLL_MS } from "@/lib/thread-messages-cache";

export function isSearchQueryValid(query: string): boolean {
	try {
		parseSearchQuery(query);
		return true;
	} catch {
		return false;
	}
}

export function useSearch(mailboxId: string, query: string) {
	const trimmed = query.trim();
	const valid = Boolean(trimmed) && isSearchQueryValid(trimmed);

	return useQuery({
		queryKey: queryKeys.search(mailboxId, trimmed),
		queryFn: async () => {
			const { data } = await searchMessages({
				throwOnError: true,
				body: {
					mailboxId,
					query: trimmed,
					limit: 50,
				},
			});
			return assertData(data, "searchMessages");
		},
		enabled: Boolean(mailboxId) && valid,
		refetchInterval: THREADS_POLL_MS,
	});
}
