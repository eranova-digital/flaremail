import { Navigate, useParams } from "react-router-dom";

import { SharedMailboxGrantEditor } from "@/components/settings/SharedMailboxGrantEditor";
import { SettingsShell } from "@/components/layout/SettingsShell";
import { Alert } from "@/components/ui/alert";
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
		<SettingsShell
			crumbs={[
				{ label: "Mailboxes", to: "/settings?tab=mailboxes" },
				{ label: mailbox?.address ?? "Shared mailbox" },
			]}
			backTo="/settings?tab=mailboxes"
			backLabel="Back to mailboxes"
			description="Control which users can read and send from this shared mailbox."
		>
			{mailboxesQuery.isLoading ? (
				<div className="space-y-3">
					<Skeleton className="h-14 w-full rounded-lg" />
					<Skeleton className="h-14 w-full rounded-lg" />
					<Skeleton className="h-10 w-64 rounded-lg" />
				</div>
			) : mailboxesQuery.isError ? (
				<Alert tone="destructive" title="Couldn't load mailboxes">
					<p>{getErrorMessage(mailboxesQuery.error)}</p>
				</Alert>
			) : !mailbox ? (
				<Alert tone="warning" title="Mailbox not found">
					<p>
						This mailbox may have been deleted, or you may not have access to
						it.
					</p>
				</Alert>
			) : mailbox.type !== "shared" ? (
				<Alert tone="warning" title="Not a shared mailbox">
					<p>Only shared mailboxes support user access management.</p>
				</Alert>
			) : (
				<SharedMailboxGrantEditor mailboxId={mailboxId} />
			)}
		</SettingsShell>
	);
}
