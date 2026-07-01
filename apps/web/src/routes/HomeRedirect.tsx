import { useEffect } from "react";
import { Navigate } from "react-router-dom";

import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMailboxes } from "@/hooks/use-mailboxes";
import {
	getLastMailboxId,
	setLastMailboxId,
} from "@/lib/mailbox-preference";
import {
	getSelectableMailboxes,
	resolveSelectableMailbox,
} from "@/lib/selectable-mailbox";

export function HomeRedirect() {
	const mailboxesQuery = useMailboxes();

	if (mailboxesQuery.isLoading) {
		return (
			<div className="flex min-h-svh items-center justify-center p-8">
				<Skeleton className="h-8 w-48" />
			</div>
		);
	}

	const selectableMailboxes = getSelectableMailboxes(mailboxesQuery.data ?? []);
	if (selectableMailboxes.length === 0) {
		return (
			<div className="flex min-h-svh flex-col items-center justify-center gap-4 p-8 text-center">
				<h1 className="text-xl font-semibold">No mailboxes yet</h1>
				<p className="text-muted-foreground max-w-md text-sm">
					Add a domain and mailbox to start receiving mail in Flaremail.
				</p>
				<Button asChild>
					<Link to="/settings">Open settings</Link>
				</Button>
			</div>
		);
	}

	const remembered = getLastMailboxId();
	const mailbox = resolveSelectableMailbox(selectableMailboxes, remembered);

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
