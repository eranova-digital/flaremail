import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronRight, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ProfileAvatar } from "@/components/ProfileAvatar";
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
	const { t } = useTranslation("management");
	const { account: actor } = useAuth();
	const accountsQuery = useAccounts();
	const [searchParams, setSearchParams] = useSearchParams();
	const accountParam = searchParams.get("account");
	const [search, setSearch] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(accountParam);

	useEffect(() => {
		setSelectedId(accountParam);
	}, [accountParam]);

	const openAccount = (accountId: string) => {
		setSelectedId(accountId);
		setSearchParams(
			(current) => {
				const next = new URLSearchParams(current);
				next.set("tab", "accounts");
				next.set("account", accountId);
				return next;
			},
			{ replace: true },
		);
	};

	const closeAccount = () => {
		setSelectedId(null);
		setSearchParams(
			(current) => {
				const next = new URLSearchParams(current);
				next.delete("account");
				return next;
			},
			{ replace: true },
		);
	};

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
					placeholder={t("accounts.searchPlaceholder")}
					className="pl-9"
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					aria-label={t("accounts.searchAria")}
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
							? t("accounts.empty.noMatch", { query: search.trim() })
							: t("accounts.empty.none")}
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
									onManage={() => openAccount(item.id)}
								/>
							))}
						</ul>
					</CardContent>
				</Card>
			)}
			<AccountDetailDialog accountId={selectedId} onClose={closeAccount} />
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
	const { t } = useTranslation("management");
	const status = statusMeta(item.status);
	const role = roleLabel(item.role, item.isIntendant);
	const description = roleDescription(item.role, item.isIntendant);

	return (
		<li className="flex items-center gap-3 px-4 py-3 text-sm">
			<ProfileAvatar
				accountId={item.id}
				seed={item.loginIdentifier}
				label={item.displayName}
				profilePicture={item.profilePicture}
				className="size-9 shrink-0 text-xs"
			/>
			<div className="min-w-0 flex-1">
				<p className="wrap-break-word font-medium">{item.displayName}</p>
				<p className="text-muted-foreground break-all text-xs">
					{item.loginIdentifier}
				</p>
			</div>
			<div className="flex shrink-0 items-center gap-2">
				<Badge
					variant="outline"
					title={description ?? undefined}
					className="justify-center"
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
					className="justify-center"
				>
					{status.label}
				</Badge>
				{canManage ? (
					<Button variant="outline" size="sm" onClick={onManage}>
						{t("accounts.manage")}
					</Button>
				) : (
					<Button
						variant="ghost"
						size="icon"
						className="size-8"
						onClick={onManage}
						aria-label={item.displayName}
					>
						<ChevronRight className="size-4" />
					</Button>
				)}
			</div>
		</li>
	);
}
