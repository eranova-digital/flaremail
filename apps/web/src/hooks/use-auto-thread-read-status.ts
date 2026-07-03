import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useThreadAction } from "@/hooks/use-thread";
import type { ThreadMessagePreview } from "@/lib/api/generated";
import { patchThreadReadInCaches } from "@/lib/thread-read-cache";

type UseAutoThreadReadStatusOptions = {
	threadIsRead?: boolean;
	messages: ThreadMessagePreview[];
	messagesReady: boolean;
};

/**
 * Marks the open thread as read when it is opened and when new inbound
 * messages arrive while the user is viewing it (the server marks inbound as
 * unread; this keeps the thread read while it stays open).
 */
export function useAutoThreadReadStatus(
	mailboxId: string,
	threadId: string | undefined,
	{ threadIsRead, messages, messagesReady }: UseAutoThreadReadStatusOptions,
) {
	const queryClient = useQueryClient();
	const markReadMutation = useThreadAction(mailboxId, threadId);
	const markReadInFlightRef = useRef(false);
	const didMarkReadOnOpenRef = useRef(false);
	const knownInboundIdsRef = useRef<Set<string>>(new Set());

	useEffect(() => {
		didMarkReadOnOpenRef.current = false;
		knownInboundIdsRef.current = new Set();
	}, [threadId]);

	const markRead = useCallback(() => {
		if (!threadId || markReadInFlightRef.current || markReadMutation.isPending) {
			return;
		}

		markReadInFlightRef.current = true;
		patchThreadReadInCaches(queryClient, mailboxId, threadId, true);

		markReadMutation.mutate("mark-read", {
			onSettled: () => {
				markReadInFlightRef.current = false;
			},
			onError: () => {
				patchThreadReadInCaches(queryClient, mailboxId, threadId, false);
			},
		});
	}, [mailboxId, markReadMutation, queryClient, threadId]);

	useEffect(() => {
		if (!threadId || !messagesReady || didMarkReadOnOpenRef.current) {
			return;
		}

		if (threadIsRead === undefined) {
			return;
		}

		didMarkReadOnOpenRef.current = true;

		if (threadIsRead === false) {
			markRead();
		}
	}, [threadId, messagesReady, threadIsRead, markRead]);

	useEffect(() => {
		if (!threadId || !messagesReady) {
			return;
		}

		const inboundIds = new Set(
			messages
				.filter((message) => message.direction === "inbound" && message.id)
				.map((message) => message.id!),
		);
		const previousInboundIds = knownInboundIdsRef.current;
		const hasNewInbound = [...inboundIds].some((id) => !previousInboundIds.has(id));

		if (hasNewInbound && previousInboundIds.size > 0) {
			markRead();
		}

		knownInboundIdsRef.current = inboundIds;
	}, [threadId, messagesReady, messages, markRead]);
}
