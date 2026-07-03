import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

export function invalidateMailboxThreads(
	queryClient: QueryClient,
	mailboxId: string,
	threadId?: string,
) {
	queryClient.invalidateQueries({
		predicate: (query) =>
			Array.isArray(query.queryKey) &&
			(query.queryKey[0] === "threads" ||
				query.queryKey[0] === "threads-by-label") &&
			query.queryKey[1] === mailboxId,
	});

	if (threadId) {
		queryClient.invalidateQueries({
			queryKey: queryKeys.threadMessages(mailboxId, threadId),
		});
		queryClient.invalidateQueries({
			queryKey: queryKeys.thread(mailboxId, threadId),
		});
	}
}
