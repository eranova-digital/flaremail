import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
	createMailbox,
	deleteMailbox,
	listMailboxes,
	updateMailbox,
	type CreateMailboxData,
	type UpdateMailboxData,
} from "@/lib/api/client";
import { assertData } from "@/lib/api/errors";
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

export function useCreateMailbox() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (body: CreateMailboxData["body"]) => {
			const { data } = await createMailbox({ throwOnError: true, body });
			return assertData(data, "createMailbox");
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.mailboxes });
		},
	});
}

export function useUpdateMailbox() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			id,
			body,
		}: {
			id: string;
			body: NonNullable<UpdateMailboxData["body"]>;
		}) => {
			const { data } = await updateMailbox({
				throwOnError: true,
				path: { id },
				body,
			});
			return assertData(data, "updateMailbox");
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.mailboxes });
		},
	});
}

export function useDeleteMailbox() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (id: string) => {
			await deleteMailbox({ throwOnError: true, path: { id } });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.mailboxes });
			queryClient.invalidateQueries({ queryKey: queryKeys.domains });
		},
	});
}
