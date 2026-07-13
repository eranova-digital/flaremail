import type { QueryClient } from "@tanstack/react-query";

import { getAccountDisplayName } from "@/components/ProfileAvatar";
import type { Thread, ThreadPage, SeenByViewer } from "@/lib/api/client";
import type { Account } from "@/lib/auth/types";
import { queryKeys } from "@/lib/query-keys";

function seenByViewerFromAccount(account: Account): SeenByViewer {
	return {
		accountId: account.id,
		loginIdentifier: account.loginIdentifier,
		displayName: getAccountDisplayName(account),
		profilePicture: account.profilePicture ?? null,
		seenAt: new Date().toISOString(),
	};
}

function withSeenByViewer(
	seenBy: SeenByViewer[] | undefined,
	viewer: SeenByViewer,
): SeenByViewer[] {
	const list = seenBy ?? [];
	if (list.some((entry) => entry.accountId === viewer.accountId)) {
		return list;
	}

	return [viewer, ...list];
}

function patchThreadSeenBy(
	thread: Thread,
	viewer: SeenByViewer,
): Thread {
	return {
		...thread,
		seenBy: withSeenByViewer(thread.seenBy, viewer),
	};
}

export function patchThreadSeenByInCaches(
	queryClient: QueryClient,
	mailboxId: string,
	threadId: string,
	account: Account,
) {
	const viewer = seenByViewerFromAccount(account);

	queryClient.setQueriesData<ThreadPage>(
		{
			predicate: (query) =>
				Array.isArray(query.queryKey) &&
				(query.queryKey[0] === "threads" ||
					query.queryKey[0] === "threads-by-label") &&
				query.queryKey[1] === mailboxId,
		},
		(old) => {
			if (!old?.items) {
				return old;
			}

			return {
				...old,
				items: old.items.map((thread) =>
					thread.id === threadId ? patchThreadSeenBy(thread, viewer) : thread,
				),
			};
		},
	);

	queryClient.setQueryData<Thread>(
		queryKeys.thread(mailboxId, threadId),
		(old) => (old ? patchThreadSeenBy(old, viewer) : old),
	);

	queryClient.setQueriesData<{ thread?: Thread; messages?: unknown[] }>(
		{
			predicate: (query) =>
				Array.isArray(query.queryKey) &&
				query.queryKey[0] === "thread-messages" &&
				query.queryKey[1] === mailboxId &&
				query.queryKey[2] === threadId,
		},
		(old) =>
			old?.thread
				? { ...old, thread: patchThreadSeenBy(old.thread, viewer) }
				: old,
	);
}
