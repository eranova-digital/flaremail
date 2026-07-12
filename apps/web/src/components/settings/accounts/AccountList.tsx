import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccounts } from "@/hooks/use-accounts";
import type { AccountSummary } from "@/lib/accounts/api";
import { canManageTarget } from "@/lib/accounts/permissions";
import { roleDescription, roleLabel, statusMeta } from "@/lib/accounts/roles";
import { useAuth } from "@/lib/auth/AuthProvider";
import { AccountDetailDialog } from "@/components/settings/accounts/AccountDetailDialog";

export function AccountList() {
	const { account: actor } = useAuth();
	const accountsQuery = useAccounts();
	const [search, setSearch] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const filtered = useMemo(() => {
		const items = accountsQuery.data ?? [];
		const query = search.trim().toLowerCase();
		if (!query) {
			return items;
		}
		return items.filter(
			(item) =>
				item.displayName.toLowerCase().includes(query) ||
				item.loginIdentifier.toLowerCase().includes(query),
		);
	}, [accountsQuery.data, search]);

	return (
		<>
			<div className="relative">
				<Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
				<Input
					placeholder="Search people by name or address…"
					className="pl-9"
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					aria-label="Search accounts"
				/>
			</div>

			{accountsQuery.isLoading ? (
				<div className="space-y-2">
					{Array.from({ length: 4 }).map((_, index) => (
						<Skeleton key={index} className="h-14 w-full rounded-lg" />
					))}
				</div>
			) : filtered.length === 0 ? (
				<Card className="gap-0 rounded-lg py-0">
					<CardContent className="text-muted-foreground px-4 py-8 text-center text-sm">
						{search.trim()
							? `No people match "${search.trim()}".`
							: "No accounts yet. Invite someone to get started."}
					</CardContent>
				</Card>
			) : (
				<Card className="gap-0 rounded-lg py-0">
					<CardContent className="p-0">
						<ul className="divide-border divide-y">
							{filtered.map((item) => (
								<AccountRow
									key={item.id}
									item={item}
									canManage={canManageTarget(actor, item)}
									onManage={() => setSelectedId(item.id)}
								/>
							))}
						</ul>
					</CardContent>
				</Card>
			)}
			<AccountDetailDialog
				accountId={selectedId}
				onClose={() => setSelectedId(null)}
			/>
		</>
	);
}

function AccountRow({
	item,
	canManage,
	onManage,
}: {
	item: AccountSummary;
	canManage: boolean;
	onManage: () => void;
}) {
	const status = statusMeta(item.status);
	const role = roleLabel(item.role, item.isIntendant);
	const description = roleDescription(item.role, item.isIntendant);

	return (
		<li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_7rem_8.5rem_5.5rem]">
			<div className="min-w-0">
				<p className="truncate font-medium">{item.displayName}</p>
				<p className="text-muted-foreground truncate text-xs">
					{item.loginIdentifier}
				</p>
			</div>
			<div className="col-span-1 flex items-center justify-end gap-2 sm:contents">
				<Badge
					variant="outline"
					title={description ?? undefined}
					className="justify-center sm:w-full"
				>
					{role}
				</Badge>
				<Badge
					variant={
						status.tone === "success"
							? "success"
							: status.tone === "warning"
								? "warning"
								: "secondary"
					}
					className="justify-center sm:w-full"
				>
					{status.label}
				</Badge>
				<div className="flex justify-end sm:w-full">
					{canManage ? (
						<Button variant="outline" size="sm" onClick={onManage}>
							Manage
						</Button>
					) : (
						<span aria-hidden className="inline-flex h-8 w-[4.75rem]" />
					)}
				</div>
			</div>
		</li>
	);
}
