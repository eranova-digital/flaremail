import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
	createMailbox,
	deleteMailbox,
	updateMailbox,
	type CreateMailboxData,
	type Mailbox,
	type UpdateMailboxData,
} from "@/lib/api/client";
import { apiRequest } from "@/lib/api/request";
import { assertData } from "@/lib/api/errors";
import { queryKeys } from "@/lib/query-keys";

export type MailboxListScope = "mail" | "manage";

async function fetchMailboxes(scope: MailboxListScope): Promise<Mailbox[]> {
	const data = await apiRequest<{ items?: Mailbox[] }>(
		`/mailboxes?scope=${scope}`,
	);
	return data.items ?? [];
}

export function useMailboxes(scope: MailboxListScope = "mail") {
	return useQuery({
		queryKey: [...queryKeys.mailboxes, scope],
		queryFn: () => fetchMailboxes(scope),
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
