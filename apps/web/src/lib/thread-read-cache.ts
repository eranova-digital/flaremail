import type { QueryClient } from "@tanstack/react-query";

import type { Thread, ThreadPage } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";

export function patchThreadReadInCaches(
	queryClient: QueryClient,
	mailboxId: string,
	threadId: string,
	isRead: boolean,
) {
	queryClient.setQueriesData<ThreadPage>(
		{
			predicate: (query) =>
				Array.isArray(query.queryKey) &&
				query.queryKey[0] === "threads" &&
				query.queryKey[1] === mailboxId,
		},
		(old) => {
			if (!old?.items) {
				return old;
			}

			return {
				...old,
				items: old.items.map((thread) =>
					thread.id === threadId ? { ...thread, isRead } : thread,
				),
			};
		},
	);

	queryClient.setQueryData<Thread>(
		queryKeys.thread(mailboxId, threadId),
		(old) => (old ? { ...old, isRead } : old),
	);

	queryClient.setQueriesData<{ thread?: Thread; messages?: unknown[] }>(
		{
			predicate: (query) =>
				Array.isArray(query.queryKey) &&
				query.queryKey[0] === "thread-messages" &&
				query.queryKey[1] === mailboxId &&
				query.queryKey[2] === threadId,
		},
		(old) => (old?.thread ? { ...old, thread: { ...old.thread, isRead } } : old),
	);
}
