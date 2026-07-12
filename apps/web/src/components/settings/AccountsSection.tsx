import { useState } from "react";
import { UserPlus, X } from "lucide-react";

import { InviteAccountForm } from "@/components/settings/accounts/InviteAccountForm";
import { AccountList } from "@/components/settings/accounts/AccountList";
import { Button } from "@/components/ui/button";
import { canAccessAccountsTab } from "@/lib/accounts/permissions";
import { useAuth } from "@/lib/auth/AuthProvider";

export function AccountsSection() {
	const { account } = useAuth();
	const [showInvite, setShowInvite] = useState(false);

	if (!canAccessAccountsTab(account)) {
		return (
			<p className="text-muted-foreground text-sm">
				You do not have permission to manage accounts.
			</p>
		);
	}

	return (
		<section className="space-y-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 className="text-lg font-medium">People & access</h2>
					<p className="text-muted-foreground text-sm">
						Manage who can use Flaremail and what they can access.
					</p>
				</div>
				<Button
					variant={showInvite ? "outline" : "default"}
					onClick={() => setShowInvite((current) => !current)}
				>
					{showInvite ? (
						<X className="size-4" aria-hidden />
					) : (
						<UserPlus className="size-4" aria-hidden />
					)}
					{showInvite ? "Close invite" : "Invite person"}
				</Button>
			</div>

			{showInvite ? <InviteAccountForm /> : null}

			<AccountList />
		</section>
	);
}
