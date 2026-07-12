import { ArrowLeft } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";

import { SharedMailboxGrantEditor } from "@/components/settings/SharedMailboxGrantEditor";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { canManageSharedMailboxUsers } from "@/lib/accounts/permissions";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getErrorMessage } from "@/lib/api/errors";

export function SharedMailboxUsersPage() {
	const { mailboxId } = useParams();
	const { account } = useAuth();
	const mailboxesQuery = useMailboxes("manage");

	if (!canManageSharedMailboxUsers(account)) {
		return <Navigate to="/settings?tab=mailboxes" replace />;
	}

	if (!mailboxId) {
		return <Navigate to="/settings?tab=mailboxes" replace />;
	}

	const mailbox = (mailboxesQuery.data ?? []).find((item) => item.id === mailboxId);

	return (
		<div className="bg-background min-h-svh">
			<header className="border-b">
				<div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
					<Button variant="ghost" size="icon" asChild>
						<Link to="/settings?tab=mailboxes" aria-label="Back to mailboxes">
							<ArrowLeft className="size-4" />
						</Link>
					</Button>
					<div className="min-w-0">
						<h1 className="truncate text-xl font-semibold tracking-tight">
							{mailbox?.address ?? "Shared mailbox"}
						</h1>
						<p className="text-muted-foreground text-sm">Manage user access</p>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-3xl px-6 py-8">
				{mailboxesQuery.isLoading ? (
					<Skeleton className="h-24 w-full" />
				) : mailboxesQuery.isError ? (
					<p className="text-destructive text-sm">
						{getErrorMessage(mailboxesQuery.error)}
					</p>
				) : !mailbox ? (
					<p className="text-destructive text-sm">Mailbox not found.</p>
				) : mailbox.type !== "shared" ? (
					<p className="text-destructive text-sm">
						Only shared mailboxes support user access management.
					</p>
				) : (
					<SharedMailboxGrantEditor mailboxId={mailboxId} />
				)}
			</main>
		</div>
	);
}
