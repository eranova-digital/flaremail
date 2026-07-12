import { useEffect } from "react";
import { Link, Navigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
	getLastMailboxId,
	setLastMailboxId,
} from "@/lib/mailbox-preference";
import { getDefaultFolderForMailbox } from "@/lib/mailbox-folders";
import {
	getSelectableMailboxes,
	resolveSelectableMailbox,
} from "@/lib/selectable-mailbox";

export function HomeRedirect() {
	const { account } = useAuth();
	const mailboxesQuery = useMailboxes();

	if (mailboxesQuery.isLoading) {
		return (
			<div className="flex min-h-svh items-center justify-center p-8">
				<Skeleton className="h-8 w-48" />
			</div>
		);
	}

	if (mailboxesQuery.isError) {
		return (
			<div className="flex min-h-svh flex-col items-center justify-center gap-4 p-8 text-center">
				<h1 className="text-xl font-semibold">Could not load mailboxes</h1>
				<p className="text-muted-foreground max-w-md text-sm">
					{mailboxesQuery.error instanceof Error
						? mailboxesQuery.error.message
						: "Try signing in again."}
				</p>
				<Button onClick={() => void mailboxesQuery.refetch()}>Retry</Button>
			</div>
		);
	}

	const selectableMailboxes = getSelectableMailboxes(mailboxesQuery.data ?? []);
	if (selectableMailboxes.length === 0) {
		return (
			<div className="flex min-h-svh flex-col items-center justify-center gap-4 p-8 text-center">
				<h1 className="text-xl font-semibold">No mailboxes yet</h1>
				<p className="text-muted-foreground max-w-md text-sm">
					{account?.isIntendant
						? "Register a domain to provision system mailboxes such as postmaster@."
						: "Add a domain and mailbox to start receiving mail in Flaremail."}
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

	return <HomeRedirectTarget mailbox={mailbox} />;
}

function HomeRedirectTarget({ mailbox }: { mailbox: NonNullable<ReturnType<typeof resolveSelectableMailbox>> }) {
	useEffect(() => {
		if (mailbox.id) {
			setLastMailboxId(mailbox.id);
		}
	}, [mailbox.id]);

	return (
		<Navigate
			to={`/m/${mailbox.id}/${getDefaultFolderForMailbox(mailbox)}`}
			replace
		/>
	);
}
