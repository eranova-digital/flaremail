import { useEffect } from "react";
import { Navigate } from "react-router-dom";

import { Skeleton } from "@/components/ui/skeleton";
import { useMailboxes } from "@/hooks/use-mailboxes";
import {
	getLastMailboxId,
	setLastMailboxId,
} from "@/lib/mailbox-preference";

export function HomeRedirect() {
	const mailboxesQuery = useMailboxes();

	if (mailboxesQuery.isLoading) {
		return (
			<div className="flex min-h-svh items-center justify-center p-8">
				<Skeleton className="h-8 w-48" />
			</div>
		);
	}

	const mailboxes = mailboxesQuery.data ?? [];
	if (mailboxes.length === 0) {
		return (
			<div className="flex min-h-svh flex-col items-center justify-center gap-2 p-8 text-center">
				<h1 className="text-xl font-semibold">No mailboxes yet</h1>
				<p className="text-muted-foreground max-w-md text-sm">
					Create a mailbox via the Worker API, then reload Flaremail.
				</p>
			</div>
		);
	}

	const remembered = getLastMailboxId();
	const mailbox =
		mailboxes.find((item) => item.id === remembered) ?? mailboxes[0];

	if (!mailbox?.id) {
		return null;
	}

	return <HomeRedirectTarget mailboxId={mailbox.id} />;
}

function HomeRedirectTarget({ mailboxId }: { mailboxId: string }) {
	useEffect(() => {
		setLastMailboxId(mailboxId);
	}, [mailboxId]);

	return <Navigate to={`/m/${mailboxId}/inbox`} replace />;
}
