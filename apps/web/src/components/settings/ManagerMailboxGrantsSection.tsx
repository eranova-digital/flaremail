import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccounts } from "@/hooks/use-accounts";
import {
	useGrantSharedMailboxAccess,
	useMailboxGrantHolders,
	useRevokeSharedMailboxAccess,
} from "@/hooks/use-accounts";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { getErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

const selectClassName =
	"border-input bg-background w-full rounded-md border px-3 py-2 text-sm";

export function ManagerMailboxGrantsSection() {
	const mailboxesQuery = useMailboxes("manage");
	const sharedMailboxes = useMemo(
		() =>
			(mailboxesQuery.data ?? []).filter((mailbox) => mailbox.type === "shared"),
		[mailboxesQuery.data],
	);

	return (
		<section className="space-y-4">
			<div>
				<h2 className="text-lg font-medium">Shared mailbox access</h2>
				<p className="text-muted-foreground text-sm">
					Grant users access to shared mailboxes you manage.
				</p>
			</div>

			{mailboxesQuery.isLoading ? (
				<div className="space-y-2">
					{Array.from({ length: 2 }).map((_, index) => (
						<Skeleton key={index} className="h-16 w-full" />
					))}
				</div>
			) : mailboxesQuery.isError ? (
				<p className="text-destructive text-sm">
					{getErrorMessage(mailboxesQuery.error)}
				</p>
			) : sharedMailboxes.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					No shared mailboxes assigned to your account.
				</p>
			) : (
				<Card className="gap-0 rounded-md py-0">
					<CardContent className="p-0">
						<ul className="divide-border divide-y">
							{sharedMailboxes.map((mailbox) =>
								mailbox.id ? (
									<SharedMailboxGrantsRow
										key={mailbox.id}
										mailboxId={mailbox.id}
										address={mailbox.address ?? mailbox.id}
									/>
								) : null,
							)}
						</ul>
					</CardContent>
				</Card>
			)}
		</section>
	);
}

function SharedMailboxGrantsRow({
	mailboxId,
	address,
}: {
	mailboxId: string;
	address: string;
}) {
	const [open, setOpen] = useState(false);
	const grantsQuery = useMailboxGrantHolders(open ? mailboxId : null);
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
		<li>
			<button
				type="button"
				onClick={() => setOpen((current) => !current)}
				className="hover:bg-muted/40 flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
			>
				<div className="min-w-0">
					<p className="truncate font-medium">{address}</p>
					<p className="text-muted-foreground text-xs">Shared mailbox</p>
				</div>
				<ChevronDown
					className={cn(
						"text-muted-foreground size-4 shrink-0 transition-transform",
						open && "rotate-180",
					)}
				/>
			</button>
			{open ? (
				<div className="space-y-3 border-t px-4 py-4">
					{grantsQuery.isLoading ? (
						<p className="text-muted-foreground text-sm">Loading grants…</p>
					) : (grantsQuery.data ?? []).length === 0 ? (
						<p className="text-muted-foreground text-sm">
							No users have access yet.
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
			) : null}
		</li>
	);
}
