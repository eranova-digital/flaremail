import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth/AuthProvider";
import { patchThreadSeenByInCaches } from "@/lib/thread-seen-by-cache";

/**
 * Optimistically adds the current user to a shared mailbox thread's seen-by
 * list when the thread is opened, before the next thread list poll.
 */
export function useAutoThreadSeenBy(
	mailboxId: string,
	threadId: string | undefined,
	isSharedMailbox: boolean,
) {
	const queryClient = useQueryClient();
	const { account } = useAuth();
	const didPatchRef = useRef(false);

	useEffect(() => {
		didPatchRef.current = false;
	}, [threadId]);

	useEffect(() => {
		if (
			!threadId ||
			!mailboxId ||
			!isSharedMailbox ||
			!account ||
			didPatchRef.current
		) {
			return;
		}

		didPatchRef.current = true;
		patchThreadSeenByInCaches(queryClient, mailboxId, threadId, account);
	}, [account, isSharedMailbox, mailboxId, queryClient, threadId]);
}
