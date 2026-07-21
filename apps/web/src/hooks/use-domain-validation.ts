import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
	cancelDomainValidationRun,
	createDomainValidationRun,
	getDomain,
	getDomainValidationRun,
	listDomainValidationRuns,
} from "@/lib/api/client";
import { assertData } from "@/lib/api/errors";
import { queryKeys } from "@/lib/query-keys";

export function useDomain(domainId: string | undefined, enabled = true) {
	return useQuery({
		queryKey: queryKeys.domain(domainId ?? ""),
		enabled: Boolean(domainId && enabled),
		queryFn: async () => {
			const { data } = await getDomain({
				throwOnError: true,
				path: { id: domainId! },
			});
			return assertData(data, "getDomain");
		},
		refetchInterval: (query) =>
			query.state.data?.readiness?.badge === "checking" ? 15_000 : false,
	});
}

export function useDomainValidationRuns(domainId: string | undefined, enabled = true) {
	return useQuery({
		queryKey: queryKeys.domainValidationRuns(domainId ?? ""),
		enabled: Boolean(domainId && enabled),
		queryFn: async () => {
			const { data } = await listDomainValidationRuns({
				throwOnError: true,
				path: { id: domainId! },
			});
			return assertData(data, "listDomainValidationRuns").items ?? [];
		},
		refetchInterval: (query) =>
			query.state.data?.some((run) => run.status === "checking") ? 15_000 : false,
	});
}

export function useDomainValidationRun(
	domainId: string | undefined,
	runId: string | null | undefined,
	enabled = true,
) {
	return useQuery({
		queryKey: queryKeys.domainValidationRun(domainId ?? "", runId ?? ""),
		enabled: Boolean(domainId && runId && enabled),
		queryFn: async () => {
			const { data } = await getDomainValidationRun({
				throwOnError: true,
				path: { id: domainId!, runId: runId! },
			});
			return assertData(data, "getDomainValidationRun");
		},
		refetchInterval: (query) =>
			query.state.data?.status === "checking" ? 15_000 : false,
	});
}

function invalidateDomainValidationQueries(
	queryClient: ReturnType<typeof useQueryClient>,
	domainId: string,
	runId?: string | null,
) {
	queryClient.invalidateQueries({ queryKey: queryKeys.domains });
	queryClient.invalidateQueries({ queryKey: queryKeys.domain(domainId) });
	queryClient.invalidateQueries({
		queryKey: queryKeys.domainValidationRuns(domainId),
	});
	if (runId) {
		queryClient.invalidateQueries({
			queryKey: queryKeys.domainValidationRun(domainId, runId),
		});
	}
}

export function useRecheckDomain() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (domainId: string) => {
			const { data } = await createDomainValidationRun({
				throwOnError: true,
				path: { id: domainId },
			});
			return assertData(data, "createDomainValidationRun");
		},
		onSuccess: (run, domainId) => {
			invalidateDomainValidationQueries(queryClient, domainId, run.id);
		},
	});
}

export function useCancelDomainValidation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			domainId,
			runId,
		}: {
			domainId: string;
			runId: string;
		}) => {
			const { data } = await cancelDomainValidationRun({
				throwOnError: true,
				path: { id: domainId, runId },
			});
			return assertData(data, "cancelDomainValidationRun");
		},
		onSuccess: (run, { domainId }) => {
			invalidateDomainValidationQueries(queryClient, domainId, run.id);
		},
	});
}
