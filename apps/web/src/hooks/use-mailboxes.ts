import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiUrl } from "@/lib/api";
import {
	createMailbox,
	deleteMailbox,
	updateMailbox,
	type CreateMailboxData,
	type Mailbox,
	type UpdateMailboxData,
} from "@/lib/api/client";
import { assertData, getErrorMessage } from "@/lib/api/errors";
import { queryKeys } from "@/lib/query-keys";

export type MailboxListScope = "mail" | "manage";

async function fetchMailboxes(scope: MailboxListScope): Promise<Mailbox[]> {
	const response = await fetch(apiUrl(`/mailboxes?scope=${scope}`), {
		credentials: "include",
	});
	if (!response.ok) {
		const body = await response.json().catch(() => null);
		throw new Error(getErrorMessage(body) ?? "Failed to load mailboxes");
	}
	const data = (await response.json()) as { items?: Mailbox[] };
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
