import { useQuery } from "@tanstack/react-query";

import { assertData } from "@/lib/api/errors";
import { listMailboxes } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";

export function useMailboxes() {
	return useQuery({
		queryKey: queryKeys.mailboxes,
		queryFn: async () => {
			const { data } = await listMailboxes({ throwOnError: true });
			return assertData(data, "listMailboxes").items ?? [];
		},
	});
}
