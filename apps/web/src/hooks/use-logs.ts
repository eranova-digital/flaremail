import { useQuery } from "@tanstack/react-query";

import { fetchLogs, type ListLogsParams } from "@/lib/logs/api";

export type UseLogsParams = Omit<ListLogsParams, "before"> & {
	before?: string;
};

export function useLogs(params: UseLogsParams) {
	const limit = params.limit ?? 25;
	return useQuery({
		queryKey: ["logs", params],
		queryFn: () =>
			fetchLogs({
				...params,
				limit,
			}),
		placeholderData: (previous) => previous,
	});
}
