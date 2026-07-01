import { Navigate, Outlet, useParams } from "react-router-dom";

import { FolderSidebar } from "@/components/layout/FolderSidebar";
import { ThreadList } from "@/components/layout/ThreadList";
import { Skeleton } from "@/components/ui/skeleton";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { getLastMailboxId } from "@/lib/mailbox-preference";
import { resolveSelectableMailbox } from "@/lib/selectable-mailbox";

export function MailboxLayout() {
	const { mailboxId } = useParams();
	const mailboxesQuery = useMailboxes();

	if (mailboxesQuery.isLoading) {
		return (
			<div className="flex min-h-svh items-center justify-center">
				<Skeleton className="h-8 w-48" />
			</div>
		);
	}

	const mailbox = mailboxesQuery.data?.find((item) => item.id === mailboxId);
	if (mailbox?.type === "alias") {
		const fallback = resolveSelectableMailbox(
			mailboxesQuery.data ?? [],
			getLastMailboxId(),
		);
		if (!fallback?.id) {
			return <Navigate to="/" replace />;
		}

		return <Navigate to={`/m/${fallback.id}/inbox`} replace />;
	}

	return (
		<div className="flex h-svh overflow-hidden">
			<FolderSidebar />
			<ThreadList />
			<main className="min-w-0 flex-1">
				<Outlet />
			</main>
		</div>
	);
}
