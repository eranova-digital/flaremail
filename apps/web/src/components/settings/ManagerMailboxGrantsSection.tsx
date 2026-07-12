import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { getErrorMessage } from "@/lib/api/errors";

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
				<h2 className="text-lg font-medium">Shared mailboxes</h2>
				<p className="text-muted-foreground text-sm">
					Choose a shared mailbox to manage which users can access it.
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
									<li key={mailbox.id}>
										<Link
											to={`/settings/mailboxes/${mailbox.id}/users`}
											className="hover:bg-muted/40 flex items-center justify-between gap-3 px-4 py-3"
										>
											<div className="min-w-0">
												<p className="truncate font-medium">{mailbox.address}</p>
												<p className="text-muted-foreground text-xs">
													Shared mailbox
												</p>
											</div>
											<Users className="text-muted-foreground size-4 shrink-0" />
										</Link>
									</li>
								) : null,
							)}
						</ul>
					</CardContent>
				</Card>
			)}
		</section>
	);
}
