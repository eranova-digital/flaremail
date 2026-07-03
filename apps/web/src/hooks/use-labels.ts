import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
	createLabel,
	deleteLabel,
	listLabels,
	patchThreadLabels,
	updateLabel,
	type Label,
} from "@/lib/api/client";
import { assertData } from "@/lib/api/errors";
import { invalidateMailboxThreads } from "@/lib/invalidate-mailbox";
import { queryKeys } from "@/lib/query-keys";

export function useLabels(mailboxId: string) {
	return useQuery({
		queryKey: queryKeys.labels(mailboxId),
		queryFn: async () => {
			const { data } = await listLabels({
				throwOnError: true,
				path: { mailboxId },
			});
			return assertData(data, "listLabels").items ?? [];
		},
		enabled: Boolean(mailboxId),
	});
}

export function useCreateLabel(mailboxId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (body: { name: string; color?: string | null }) => {
			const { data } = await createLabel({
				throwOnError: true,
				path: { mailboxId },
				body,
			});
			return assertData(data, "createLabel");
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.labels(mailboxId) });
		},
	});
}

export function useUpdateLabel(mailboxId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			id,
			body,
		}: {
			id: string;
			body: { name?: string; color?: string | null };
		}) => {
			const { data } = await updateLabel({
				throwOnError: true,
				path: { mailboxId, id },
				body,
			});
			return assertData(data, "updateLabel");
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.labels(mailboxId) });
		},
	});
}

export function useDeleteLabel(mailboxId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (id: string) => {
			await deleteLabel({
				throwOnError: true,
				path: { mailboxId, id },
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.labels(mailboxId) });
			invalidateMailboxThreads(queryClient, mailboxId);
		},
	});
}

export function usePatchThreadLabels(mailboxId: string, threadId: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (labelIds: string[]) => {
			const { data } = await patchThreadLabels({
				throwOnError: true,
				path: { id: threadId },
				query: { mailboxId },
				body: { labelIds },
			});
			return assertData(data, "patchThreadLabels");
		},
		onSuccess: () => {
			invalidateMailboxThreads(queryClient, mailboxId, threadId);
		},
	});
}

export function labelById(labels: Label[], id: string): Label | undefined {
	return labels.find((label) => label.id === id);
}
