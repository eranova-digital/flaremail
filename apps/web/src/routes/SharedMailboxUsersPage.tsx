import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

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
	const { t } = useTranslation("management");
	const { t: tc } = useTranslation("common");
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
			rootLabel={tc("management")}
			rootTo="/management"
			crumbs={[
				{ label: t("mailboxes.title"), to: "/management?tab=mailboxes" },
				{ label: mailbox?.address ?? t("sharedMailboxUsers.crumbFallback") },
			]}
			backTo="/management?tab=mailboxes"
			backLabel={t("shell.backToMailboxes")}
			description={t("sharedMailboxUsers.description")}
		>
			{mailboxesQuery.isLoading ? (
				<div className="space-y-3">
					<Skeleton className="h-14 w-full rounded-lg" />
					<Skeleton className="h-14 w-full rounded-lg" />
					<Skeleton className="h-10 w-64 rounded-lg" />
				</div>
			) : mailboxesQuery.isError ? (
				<Alert
					tone="destructive"
					title={t("sharedMailboxUsers.loadErrorTitle")}
				>
					<p>{getErrorMessage(mailboxesQuery.error)}</p>
				</Alert>
			) : !mailbox ? (
				<Alert tone="warning" title={t("sharedMailboxUsers.notFoundTitle")}>
					<p>{t("sharedMailboxUsers.notFoundBody")}</p>
				</Alert>
			) : mailbox.type !== "shared" ? (
				<Alert tone="warning" title={t("sharedMailboxUsers.notSharedTitle")}>
					<p>{t("sharedMailboxUsers.notSharedBody")}</p>
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
						<TabsTrigger value="users">
							{t("sharedMailboxUsers.tab.users")}
						</TabsTrigger>
						<TabsTrigger value="identities">
							{t("sharedMailboxUsers.tab.identities")}
						</TabsTrigger>
					</TabsList>
					<TabsContent value="users" className="space-y-8 pt-4">
						{canManageManagerMailboxAssignments(account) ? (
							<SharedMailboxManagerEditor mailboxId={mailboxId} />
						) : null}

						<section className="space-y-4">
							<div>
								<h2 className="text-base font-medium">
									{t("sharedMailboxUsers.userAccess.title")}
								</h2>
								<p className="text-muted-foreground text-sm">
									{t("sharedMailboxUsers.userAccess.description")}
									{account?.role === "admin" || account?.role === "superadmin" ? (
										<> {t("sharedMailboxUsers.userAccess.adminNote")}</>
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
