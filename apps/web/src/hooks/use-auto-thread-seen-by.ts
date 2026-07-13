import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth/AuthProvider";
import { patchMessageSeenByInCaches } from "@/lib/thread-seen-by-cache";

/**
 * Optimistically adds the current user to each message's seen-by list when a shared
 * mailbox thread is opened, before the next poll.
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
		patchMessageSeenByInCaches(queryClient, mailboxId, threadId, account);
	}, [account, isSharedMailbox, mailboxId, queryClient, threadId]);
}
