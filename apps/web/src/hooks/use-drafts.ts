import { useQuery } from "@tanstack/react-query";

import { assertData } from "@/lib/api/errors";
import { listDrafts } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";
import { THREADS_POLL_MS } from "@/lib/thread-messages-cache";

export function useDrafts(mailboxId: string, cursor?: string | null) {
	return useQuery({
		queryKey: queryKeys.drafts(mailboxId, cursor),
		queryFn: async () => {
			const { data } = await listDrafts({
				throwOnError: true,
				query: {
					mailboxId,
					cursor: cursor ?? undefined,
					limit: 50,
				},
			});
			return assertData(data, "listDrafts");
		},
		enabled: Boolean(mailboxId),
		refetchInterval: THREADS_POLL_MS,
	});
}
