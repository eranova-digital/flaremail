import { useState } from "react";
import { UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";

import { InviteAccountDialog } from "@/components/settings/accounts/InviteAccountDialog";
import { AccountList } from "@/components/settings/accounts/AccountList";
import { Button } from "@/components/ui/button";
import { canAccessAccountsTab } from "@/lib/accounts/permissions";
import { useAuth } from "@/lib/auth/AuthProvider";

export function AccountsSection() {
	const { t } = useTranslation("management");
	const { account } = useAuth();
	const [inviteOpen, setInviteOpen] = useState(false);

	if (!canAccessAccountsTab(account)) {
		return (
			<p className="text-muted-foreground text-sm">
				{t("accounts.noPermission")}
			</p>
		);
	}

	return (
		<section className="space-y-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 className="text-lg font-medium">{t("accounts.title")}</h2>
					<p className="text-muted-foreground text-sm">
						{t("accounts.description")}
					</p>
				</div>
				<Button onClick={() => setInviteOpen(true)}>
					<UserPlus className="size-4" aria-hidden />
					{t("accounts.invite")}
				</Button>
			</div>

			<AccountList />

			<InviteAccountDialog open={inviteOpen} onOpenChange={setInviteOpen} />
		</section>
	);
}
