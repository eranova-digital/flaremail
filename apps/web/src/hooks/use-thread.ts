import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { assertData } from "@/lib/api/errors";
import {
	getMessage,
	getThread,
	listThreadMessages,
	runThreadAction,
	sendDraft,
} from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";

export function useSendDraft(mailboxId: string, threadId?: string) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (draftId: string) => {
			const { data } = await sendDraft({
				throwOnError: true,
				path: { id: draftId },
			});
			return assertData(data, "sendDraft");
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["threads", mailboxId] });
			if (threadId) {
				queryClient.invalidateQueries({
					queryKey: queryKeys.threadMessages(mailboxId, threadId),
				});
				queryClient.invalidateQueries({
					queryKey: queryKeys.thread(mailboxId, threadId),
				});
			}
		},
	});
}

export function useThread(mailboxId: string, threadId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.thread(mailboxId, threadId ?? ""),
		queryFn: async () => {
			const { data } = await getThread({
				throwOnError: true,
				path: { id: threadId! },
				query: { mailboxId },
			});
			return assertData(data, "getThread");
		},
		enabled: Boolean(mailboxId && threadId),
	});
}

export function useThreadMessages(
	mailboxId: string,
	threadId: string | undefined,
) {
	return useQuery({
		queryKey: queryKeys.threadMessages(mailboxId, threadId ?? ""),
		queryFn: async () => {
			const { data } = await listThreadMessages({
				throwOnError: true,
				path: { id: threadId! },
				query: { mailboxId },
			});
			return assertData(data, "listThreadMessages");
		},
		enabled: Boolean(mailboxId && threadId),
	});
}

export function useMessage(mailboxId: string, messageId: string | undefined) {
	return useQuery({
		queryKey: queryKeys.message(mailboxId, messageId ?? ""),
		queryFn: async () => {
			const { data } = await getMessage({
				throwOnError: true,
				path: { id: messageId! },
				query: { mailboxId },
			});
			return assertData(data, "getMessage");
		},
		enabled: Boolean(mailboxId && messageId),
	});
}

type ThreadAction = Parameters<typeof runThreadAction>[0]["path"]["action"];

export function useThreadAction(
	mailboxId: string,
	threadId: string | undefined,
) {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (action: ThreadAction) => {
			const { data } = await runThreadAction({
				throwOnError: true,
				path: { id: threadId!, action },
				query: { mailboxId },
			});
			return assertData(data, "runThreadAction");
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["threads", mailboxId],
			});
			if (threadId) {
				queryClient.invalidateQueries({
					queryKey: queryKeys.thread(mailboxId, threadId),
				});
				queryClient.invalidateQueries({
					queryKey: queryKeys.threadMessages(mailboxId, threadId),
				});
			}
		},
	});
}
