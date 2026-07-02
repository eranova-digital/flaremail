import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
	createDomain,
	deleteDomain,
	listDomains,
	updateDomain,
	type CreateDomainData,
	type UpdateDomainData,
} from "@/lib/api/client";
import { assertData } from "@/lib/api/errors";
import { queryKeys } from "@/lib/query-keys";

export function useDomains() {
	return useQuery({
		queryKey: queryKeys.domains,
		queryFn: async () => {
			const { data } = await listDomains({ throwOnError: true });
			return assertData(data, "listDomains").items ?? [];
		},
		refetchInterval: (query) => {
			const domains = query.state.data;
			if (!domains?.some((domain) => domain.readiness?.badge === "checking")) {
				return false;
			}
			return 15_000;
		},
	});
}

export function useCreateDomain() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (body: CreateDomainData["body"]) => {
			const { data } = await createDomain({ throwOnError: true, body });
			return assertData(data, "createDomain");
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.domains });
		},
	});
}

export function useUpdateDomain() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			id,
			body,
		}: {
			id: string;
			body: NonNullable<UpdateDomainData["body"]>;
		}) => {
			const { data } = await updateDomain({
				throwOnError: true,
				path: { id },
				body,
			});
			return assertData(data, "updateDomain");
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.domains });
		},
	});
}

export function useDeleteDomain() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (id: string) => {
			await deleteDomain({ throwOnError: true, path: { id } });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.domains });
			queryClient.invalidateQueries({ queryKey: queryKeys.mailboxes });
		},
	});
}
