import { useMemo, useState } from "react";
import { Shield } from "lucide-react";
import { useTranslation } from "react-i18next";

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
import {
	useAccounts,
	useGrantManagerMailboxAssignment,
	useMailboxManagerAssignments,
	useRevokeManagerMailboxAssignment,
} from "@/hooks/use-accounts";
import { getErrorMessage } from "@/lib/api/errors";

type SharedMailboxManagerEditorProps = {
	mailboxId: string;
};

export function SharedMailboxManagerEditor({
	mailboxId,
}: SharedMailboxManagerEditorProps) {
	const { t } = useTranslation("management");
	const { t: tc } = useTranslation("common");
	const assignmentsQuery = useMailboxManagerAssignments(mailboxId);
	const accountsQuery = useAccounts();
	const grantMutation = useGrantManagerMailboxAssignment();
	const revokeMutation = useRevokeManagerMailboxAssignment();
	const [selectedAccountId, setSelectedAccountId] = useState("");
	const [error, setError] = useState<string | null>(null);

	const assignableManagers = useMemo(() => {
		const assignedIds = new Set(
			(assignmentsQuery.data ?? []).map((holder) => holder.accountId),
		);
		return (accountsQuery.data ?? []).filter(
			(account) =>
				account.role === "manager" &&
				account.status === "active" &&
				!assignedIds.has(account.id),
		);
	}, [accountsQuery.data, assignmentsQuery.data]);

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
		<section className="space-y-4">
			<div>
				<h2 className="text-base font-medium">{t("mailboxes.managerGrants.title")}</h2>
				<p className="text-muted-foreground text-sm">
					{t("mailboxes.managerGrants.description")}
				</p>
			</div>

			{assignmentsQuery.isLoading ? (
				<div className="space-y-2">
					{Array.from({ length: 2 }).map((_, index) => (
						<Skeleton key={index} className="h-14 w-full rounded-lg" />
					))}
				</div>
			) : (assignmentsQuery.data ?? []).length === 0 ? (
				<Card className="gap-0 rounded-lg py-0">
					<CardContent className="flex flex-col items-center gap-2 px-4 py-10 text-center">
						<Shield className="text-muted-foreground/60 size-6" aria-hidden />
						<p className="text-sm font-medium">{t("sharedMailboxUsers.managers.emptyTitle")}</p>
						<p className="text-muted-foreground max-w-sm text-sm">
							{t("sharedMailboxUsers.managers.emptyDesc")}
						</p>
					</CardContent>
				</Card>
			) : (
				<Card className="gap-0 rounded-lg py-0">
					<CardContent className="p-0">
						<ul className="divide-border divide-y">
							{assignmentsQuery.data?.map((holder) => (
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
										{holder.viaAllShared ? (
											<Badge variant="outline">
												{t("sharedMailboxUsers.managers.allSharedBadge")}
											</Badge>
										) : null}
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
											{tc("remove")}
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
					<label className="text-sm font-medium" htmlFor="assign-manager">
						{t("sharedMailboxUsers.managers.add")}
					</label>
					<Select
						value={selectedAccountId || undefined}
						onValueChange={setSelectedAccountId}
						disabled={
							assignableManagers.length === 0 || grantMutation.isPending
						}
					>
						<SelectTrigger id="assign-manager">
							<SelectValue placeholder={t("sharedMailboxUsers.managers.select")} />
						</SelectTrigger>
						<SelectContent>
							{assignableManagers.map((manager) => (
								<SelectItem key={manager.id} value={manager.id}>
									{manager.displayName} ({manager.loginIdentifier})
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<Button
					onClick={handleGrant}
					disabled={!selectedAccountId || grantMutation.isPending}
				>
					{t("sharedMailboxUsers.managers.assign")}
				</Button>
			</div>
			{error ? (
				<Alert tone="destructive" title={t("sharedMailboxUsers.managers.errorTitle")}>
					<p>{error}</p>
				</Alert>
			) : null}
		</section>
	);
}
