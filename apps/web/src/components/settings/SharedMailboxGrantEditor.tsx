import { useMemo, useState } from "react";
import { Users } from "lucide-react";

import { ProfileAvatar } from "@/components/ProfileAvatar";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useAccounts } from "@/hooks/use-accounts";
import {
	useGrantSharedMailboxAccess,
	useMailboxGrantHolders,
	useRevokeSharedMailboxAccess,
} from "@/hooks/use-accounts";
import { getErrorMessage } from "@/lib/api/errors";

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
				<div className="space-y-2">
					{Array.from({ length: 2 }).map((_, index) => (
						<Skeleton key={index} className="h-14 w-full rounded-lg" />
					))}
				</div>
			) : (grantsQuery.data ?? []).length === 0 ? (
				<Card className="gap-0 rounded-lg py-0">
					<CardContent className="flex flex-col items-center gap-2 px-4 py-10 text-center">
						<Users className="text-muted-foreground/60 size-6" aria-hidden />
						<p className="text-sm font-medium">No one has access yet</p>
						<p className="text-muted-foreground max-w-sm text-sm">
							Grant a user access below so they can read and send from this
							mailbox.
						</p>
					</CardContent>
				</Card>
			) : (
				<Card className="gap-0 rounded-lg py-0">
					<CardContent className="p-0">
						<ul className="divide-border divide-y">
							{grantsQuery.data?.map((holder) => (
								<li
									key={holder.accountId}
									className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
								>
									<div className="flex min-w-0 items-center gap-3">
										<ProfileAvatar
											accountId={holder.accountId}
											seed={holder.loginIdentifier}
											label={holder.displayName}
											profilePicture={holder.profilePicture}
											className="size-9 text-xs"
										/>
										<div className="min-w-0">
										<p className="truncate font-medium">{holder.displayName}</p>
										<p className="text-muted-foreground truncate text-xs">
											{holder.loginIdentifier}
										</p>
										</div>
									</div>
									<div className="flex shrink-0 items-center gap-2">
										<Badge
											variant={
												holder.status === "active" ? "success" : "secondary"
											}
										>
											{holder.status}
										</Badge>
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
					</CardContent>
				</Card>
			)}

			<div className="flex flex-col gap-2 sm:flex-row sm:items-end">
				<div className="min-w-0 flex-1 space-y-1">
					<label className="text-sm font-medium" htmlFor="grant-user">
						Add user
					</label>
					<Select
						value={selectedAccountId || undefined}
						onValueChange={setSelectedAccountId}
						disabled={grantableUsers.length === 0 || grantMutation.isPending}
					>
						<SelectTrigger id="grant-user">
							<SelectValue placeholder="Select user…" />
						</SelectTrigger>
						<SelectContent>
							{grantableUsers.map((user) => (
								<SelectItem key={user.id} value={user.id}>
									{user.displayName} ({user.loginIdentifier})
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<Button
					onClick={handleGrant}
					disabled={!selectedAccountId || grantMutation.isPending}
				>
					Grant access
				</Button>
			</div>
			{error ? (
				<Alert tone="destructive" title="Couldn't grant access">
					<p>{error}</p>
				</Alert>
			) : null}
		</div>
	);
}
