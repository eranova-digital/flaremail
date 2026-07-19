import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { canAccessManagementPage } from "@/lib/accounts/permissions";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
	getLastMailboxId,
	setLastMailboxId,
} from "@/lib/mailbox-preference";
import { getDefaultFolderForMailbox } from "@/lib/mailbox-folders";
import {
	getSelectableMailboxes,
	resolveSelectableMailbox,
} from "@/lib/selectable-mailbox";

export function HomeRedirect() {
	const { t } = useTranslation("mail");
	const { account } = useAuth();
	const mailboxesQuery = useMailboxes();

	if (mailboxesQuery.isLoading) {
		return (
			<div className="flex min-h-svh items-center justify-center p-8">
				<Skeleton className="h-8 w-48" />
			</div>
		);
	}

	if (mailboxesQuery.isError) {
		return (
			<div className="flex min-h-svh flex-col items-center justify-center gap-4 p-8 text-center">
				<h1 className="text-xl font-semibold">{t("empty.loadMailboxesTitle")}</h1>
				<p className="text-muted-foreground max-w-md text-sm">
					{mailboxesQuery.error instanceof Error
						? mailboxesQuery.error.message
						: t("empty.loadMailboxesFallback")}
				</p>
				<Button onClick={() => void mailboxesQuery.refetch()}>
					{t("empty.retry")}
				</Button>
			</div>
		);
	}

	const selectableMailboxes = getSelectableMailboxes(mailboxesQuery.data ?? []);
	if (selectableMailboxes.length === 0) {
		const setupPath = canAccessManagementPage(account) ? "/management" : "/settings";
		const setupLabel = canAccessManagementPage(account)
			? t("empty.openManagement")
			: t("empty.openSettings");

		return (
			<div className="flex min-h-svh flex-col items-center justify-center gap-4 p-8 text-center">
				<h1 className="text-xl font-semibold">{t("empty.noMailboxesTitle")}</h1>
				<p className="text-muted-foreground max-w-md text-sm">
					{account?.isIntendant
						? t("empty.noMailboxesIntendant")
						: t("empty.noMailboxesUser")}
				</p>
				<Button asChild>
					<Link to={setupPath}>{setupLabel}</Link>
				</Button>
			</div>
		);
	}

	const remembered = getLastMailboxId();
	const mailbox = resolveSelectableMailbox(selectableMailboxes, remembered);

	if (!mailbox?.id) {
		return null;
	}

	return <HomeRedirectTarget mailbox={mailbox} />;
}

function HomeRedirectTarget({ mailbox }: { mailbox: NonNullable<ReturnType<typeof resolveSelectableMailbox>> }) {
	useEffect(() => {
		if (mailbox.id) {
			setLastMailboxId(mailbox.id);
		}
	}, [mailbox.id]);

	return (
		<Navigate
			to={`/m/${mailbox.id}/${getDefaultFolderForMailbox(mailbox)}`}
			replace
		/>
	);
}
