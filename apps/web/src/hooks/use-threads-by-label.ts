import { useQueries } from "@tanstack/react-query";

import { assertData } from "@/lib/api/errors";
import { listThreads, type ThreadFolder } from "@/lib/api/client";
import { FOLDERS } from "@/lib/folders";
import { queryKeys } from "@/lib/query-keys";
import { THREADS_POLL_MS } from "@/lib/thread-messages-cache";

export function useThreadsByLabel(mailboxId: string, labelId: string) {
	return useQueries({
		queries: FOLDERS.map((folder) => ({
			queryKey: queryKeys.threadsByLabel(mailboxId, labelId, folder),
			queryFn: async () => {
				const { data } = await listThreads({
					throwOnError: true,
					query: {
						mailboxId,
						folder,
						labelId,
						limit: 50,
					},
				});
				const result = assertData(data, "listThreads");
				// Defensive client-side filter: the deployed worker may not yet
				// support the `labelId` query param, in which case it returns every
				// thread in the folder. Keep only threads that carry this label.
				const items = (result.items ?? []).filter((thread) =>
					thread.labelIds?.includes(labelId),
				);
				return {
					folder,
					...result,
					items,
				};
			},
			enabled: Boolean(mailboxId && labelId),
			refetchInterval: THREADS_POLL_MS,
		})),
	});
}

export type ThreadsByLabelFolderResult = {
	folder: ThreadFolder;
	items: NonNullable<
		Awaited<ReturnType<typeof listThreads>>["data"]
	>["items"];
	isLoading: boolean;
	isError: boolean;
	isFetching: boolean;
	refetch: () => void;
};
