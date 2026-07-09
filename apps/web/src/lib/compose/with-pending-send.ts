import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

import {
	addPendingSend,
	buildPendingMessage,
	removePendingSend,
} from "./pending-sends";

export type PendingSendPreview = Omit<
	Parameters<typeof buildPendingMessage>[0],
	"draftId"
>;

export async function withPendingSend<T>(
	queryClient: QueryClient,
	mailboxId: string,
	threadId: string | undefined,
	draftId: string,
	preview: PendingSendPreview,
	sendFn: () => Promise<T>,
): Promise<T> {
	if (!threadId) {
		return sendFn();
	}

	await queryClient.cancelQueries({
		queryKey: queryKeys.threadMessages(mailboxId, threadId),
	});
	addPendingSend(threadId, buildPendingMessage({ draftId, ...preview }));

	try {
		const result = await sendFn();
		await queryClient.invalidateQueries({
			queryKey: queryKeys.threadMessages(mailboxId, threadId),
		});
		return result;
	} finally {
		removePendingSend(threadId, draftId);
	}
}
