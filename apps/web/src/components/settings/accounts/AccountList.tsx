import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAccounts } from "@/hooks/use-accounts";
import type { AccountSummary } from "@/lib/accounts/api";
import { AccountDetailDialog } from "@/components/settings/accounts/AccountDetailDialog";

export function AccountList() {
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
			<Card>
				<CardHeader>
					<CardTitle>Accounts</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<Input
						placeholder="Search accounts"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
					/>
					{accountsQuery.isLoading ? (
						<p className="text-muted-foreground text-sm">Loading accounts…</p>
					) : filtered.length === 0 ? (
						<p className="text-muted-foreground text-sm">No accounts found.</p>
					) : (
						<div className="space-y-2">
							{filtered.map((item) => (
								<AccountRow
									key={item.id}
									item={item}
									onManage={() => setSelectedId(item.id)}
								/>
							))}
						</div>
					)}
				</CardContent>
			</Card>
			<AccountDetailDialog
				accountId={selectedId}
				onClose={() => setSelectedId(null)}
			/>
		</>
	);
}

function AccountRow({
	item,
	onManage,
}: {
	item: AccountSummary;
	onManage: () => void;
}) {
	return (
		<div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
			<div className="min-w-0">
				<p className="truncate font-medium">{item.displayName}</p>
				<p className="text-muted-foreground truncate text-xs">
					{item.loginIdentifier}
				</p>
			</div>
			<div className="flex shrink-0 items-center gap-2">
				<Badge variant="secondary">
					{item.role ?? "intendant"} · {item.status}
				</Badge>
				<Button variant="outline" size="sm" onClick={onManage}>
					Manage
				</Button>
			</div>
		</div>
	);
}
