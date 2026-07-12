import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAccounts } from "@/hooks/use-accounts";
import {
	useGrantSharedMailboxAccess,
	useMailboxGrantHolders,
	useRevokeSharedMailboxAccess,
} from "@/hooks/use-accounts";
import { getErrorMessage } from "@/lib/api/errors";

const selectClassName =
	"border-input bg-background w-full rounded-md border px-3 py-2 text-sm";

type SharedMailboxGrantEditorProps = {
	mailboxId: string;
};

export function SharedMailboxGrantEditor({
	mailboxId,
}: SharedMailboxGrantEditorProps) {
	const grantsQuery = useMailboxGrantHolders(mailboxId);
	const accountsQuery = useAccounts();
	const grantMutation = useGrantSharedMailboxAccess();
	const revokeMutation = useRevokeSharedMailboxAccess();
	const [selectedAccountId, setSelectedAccountId] = useState("");
	const [error, setError] = useState<string | null>(null);

	const grantableUsers = useMemo(() => {
		const grantedIds = new Set(
			(grantsQuery.data ?? []).map((holder) => holder.accountId),
		);
		return (accountsQuery.data ?? []).filter(
			(account) =>
				account.role === "user" &&
				account.status === "active" &&
				!grantedIds.has(account.id),
		);
	}, [accountsQuery.data, grantsQuery.data]);

	const handleGrant = () => {
		if (!selectedAccountId) {
			return;
		}
		setError(null);
		grantMutation.mutate(
			{ accountId: selectedAccountId, mailboxId },
			{
				onSuccess: () => setSelectedAccountId(""),
				onError: (err) => setError(getErrorMessage(err)),
			},
		);
	};

	return (
		<div className="space-y-4">
			{grantsQuery.isLoading ? (
				<p className="text-muted-foreground text-sm">Loading users…</p>
			) : (grantsQuery.data ?? []).length === 0 ? (
				<p className="text-muted-foreground text-sm">
					No users have access to this mailbox yet.
				</p>
			) : (
				<ul className="space-y-2">
					{grantsQuery.data?.map((holder) => (
						<li
							key={holder.accountId}
							className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
						>
							<div className="min-w-0">
								<p className="truncate font-medium">{holder.displayName}</p>
								<p className="text-muted-foreground truncate text-xs">
									{holder.loginIdentifier}
								</p>
							</div>
							<div className="flex shrink-0 items-center gap-2">
								<Badge variant="secondary">{holder.status}</Badge>
								<Button
									variant="outline"
									size="sm"
									disabled={revokeMutation.isPending}
									onClick={() =>
										revokeMutation.mutate({
											accountId: holder.accountId,
											mailboxId,
										})
									}
								>
									Revoke
								</Button>
							</div>
						</li>
					))}
				</ul>
			)}

			<div className="flex flex-col gap-2 sm:flex-row sm:items-end">
				<div className="min-w-0 flex-1 space-y-1">
					<label className="text-sm font-medium">Add user</label>
					<select
						className={selectClassName}
						value={selectedAccountId}
						onChange={(event) => setSelectedAccountId(event.target.value)}
					>
						<option value="">Select user</option>
						{grantableUsers.map((user) => (
							<option key={user.id} value={user.id}>
								{user.displayName} ({user.loginIdentifier})
							</option>
						))}
					</select>
				</div>
				<Button
					onClick={handleGrant}
					disabled={!selectedAccountId || grantMutation.isPending}
				>
					Grant access
				</Button>
			</div>
			{error ? <p className="text-destructive text-sm">{error}</p> : null}
		</div>
	);
}
