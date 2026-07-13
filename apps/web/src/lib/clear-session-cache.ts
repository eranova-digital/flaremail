import type { QueryClient } from "@tanstack/react-query";

import { clearLastMailboxId } from "@/lib/mailbox-preference";

export function clearSessionQueryCache(queryClient: QueryClient): void {
	queryClient.clear();
	clearLastMailboxId();
}
