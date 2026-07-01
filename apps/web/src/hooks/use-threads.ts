import { useQuery } from "@tanstack/react-query";

import { assertData } from "@/lib/api/errors";
import { listThreads, type ThreadFolder } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";

export function useThreads(
	mailboxId: string,
	folder: ThreadFolder,
	cursor?: string | null,
) {
	return useQuery({
		queryKey: queryKeys.threads(mailboxId, folder, cursor),
		queryFn: async () => {
			const { data } = await listThreads({
				throwOnError: true,
				query: {
					mailboxId,
					folder,
					cursor: cursor ?? undefined,
					limit: 50,
				},
			});
			return assertData(data, "listThreads");
		},
		enabled: Boolean(mailboxId),
	});
}
