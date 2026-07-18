import { Navigate, useParams, useSearchParams } from "react-router-dom";

import { SharedMailboxGrantEditor } from "@/components/settings/SharedMailboxGrantEditor";
import { SharedMailboxIdentitiesEditor } from "@/components/settings/SharedMailboxIdentitiesEditor";
import { SharedMailboxManagerEditor } from "@/components/settings/SharedMailboxManagerEditor";
import { SettingsShell } from "@/components/layout/SettingsShell";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMailboxes } from "@/hooks/use-mailboxes";
import {
	canManageManagerMailboxAssignments,
	canManageSharedMailboxUsers,
} from "@/lib/accounts/permissions";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getErrorMessage } from "@/lib/api/errors";

export function SharedMailboxUsersPage() {
	const { mailboxId } = useParams();
	const [searchParams, setSearchParams] = useSearchParams();
	const { account } = useAuth();
	const mailboxesQuery = useMailboxes("manage");
	const tab = searchParams.get("tab") === "identities" ? "identities" : "users";

	if (!canManageSharedMailboxUsers(account)) {
		return <Navigate to="/management?tab=mailboxes" replace />;
	}

	if (!mailboxId) {
		return <Navigate to="/management?tab=mailboxes" replace />;
	}

	const mailbox = (mailboxesQuery.data ?? []).find((item) => item.id === mailboxId);

	return (
		<SettingsShell
			rootLabel="Management"
			rootTo="/management"
			crumbs={[
				{ label: "Mailboxes", to: "/management?tab=mailboxes" },
				{ label: mailbox?.address ?? "Shared mailbox" },
			]}
			backTo="/management?tab=mailboxes"
			backLabel="Back to mailboxes"
			description="Control who can administer and use this shared mailbox, and how send personas work."
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
				<Tabs
					value={tab}
					onValueChange={(value) => {
						setSearchParams(
							(current) => {
								const next = new URLSearchParams(current);
								if (value === "users") {
									next.delete("tab");
								} else {
									next.set("tab", value);
								}
								return next;
							},
							{ replace: true },
						);
					}}
				>
					<TabsList>
						<TabsTrigger value="users">Users</TabsTrigger>
						<TabsTrigger value="identities">Identities</TabsTrigger>
					</TabsList>
					<TabsContent value="users" className="space-y-8 pt-4">
						{canManageManagerMailboxAssignments(account) ? (
							<SharedMailboxManagerEditor mailboxId={mailboxId} />
						) : null}

						<section className="space-y-4">
							<div>
								<h2 className="text-base font-medium">User access</h2>
								<p className="text-muted-foreground text-sm">
									Users granted here can read and send from this shared mailbox.
									{account?.role === "admin" || account?.role === "superadmin" ? (
										<>
											{" "}
											Admins and owners already have mail access to all mailboxes
											on their domains and do not need to be added here.
										</>
									) : null}
								</p>
							</div>
							<SharedMailboxGrantEditor mailboxId={mailboxId} />
						</section>
					</TabsContent>
					<TabsContent value="identities" className="pt-4">
						<SharedMailboxIdentitiesEditor mailbox={mailbox} />
					</TabsContent>
				</Tabs>
			)}
		</SettingsShell>
	);
}
