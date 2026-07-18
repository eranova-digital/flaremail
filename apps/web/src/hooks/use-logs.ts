import { useInfiniteQuery } from "@tanstack/react-query";

import { fetchLogs, type ListLogsParams } from "@/lib/logs/api";

export function useLogs(params: Omit<ListLogsParams, "before" | "limit">) {
	return useInfiniteQuery({
		queryKey: ["logs", params],
		queryFn: ({ pageParam }) =>
			fetchLogs({
				...params,
				limit: 50,
				before: pageParam,
			}),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (lastPage) => lastPage.nextBefore ?? undefined,
	});
}
