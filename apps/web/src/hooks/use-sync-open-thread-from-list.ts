import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { Thread, ThreadFolder } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";
import { useThreads } from "@/hooks/use-threads";

type ThreadListSnapshot = {
	lastMessageAt?: string;
	messageCount?: number;
	preview?: string | null;
};

function snapshotFromThread(thread: Thread): ThreadListSnapshot {
	return {
		lastMessageAt: thread.lastMessageAt,
		messageCount: thread.messageCount,
		preview: thread.preview,
	};
}

function hasThreadListUpdate(
	previous: ThreadListSnapshot | undefined,
	current: ThreadListSnapshot,
): boolean {
	if (!previous) {
		return false;
	}

	return (
		previous.lastMessageAt !== current.lastMessageAt ||
		previous.messageCount !== current.messageCount ||
		previous.preview !== current.preview
	);
}

/**
 * When the polled thread list shows the open thread changed, refetch its
 * messages so ThreadView stays in sync without relying on a separate poll.
 */
export function useSyncOpenThreadFromList(
	mailboxId: string,
	threadId: string | undefined,
	folder: ThreadFolder,
) {
	const queryClient = useQueryClient();
	const threadsQuery = useThreads(mailboxId, folder);
	const snapshotRef = useRef<{ threadId?: string; snapshot?: ThreadListSnapshot }>(
		{},
	);

	useEffect(() => {
		if (!threadId || !mailboxId) {
			return;
		}

		const thread = threadsQuery.data?.items?.find((item) => item.id === threadId);
		if (!thread) {
			return;
		}

		const current = snapshotFromThread(thread);
		const { threadId: previousThreadId, snapshot: previousSnapshot } =
			snapshotRef.current;

		if (
			previousThreadId === threadId &&
			hasThreadListUpdate(previousSnapshot, current)
		) {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.threadMessages(mailboxId, threadId),
			});
		}

		snapshotRef.current = { threadId, snapshot: current };
	}, [mailboxId, threadId, folder, threadsQuery.data, queryClient]);
}
