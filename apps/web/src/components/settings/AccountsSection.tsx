import { useState } from "react";
import { UserPlus } from "lucide-react";

import { InviteAccountDialog } from "@/components/settings/accounts/InviteAccountDialog";
import { AccountList } from "@/components/settings/accounts/AccountList";
import { Button } from "@/components/ui/button";
import { canAccessAccountsTab } from "@/lib/accounts/permissions";
import { useAuth } from "@/lib/auth/AuthProvider";

export function AccountsSection() {
	const { account } = useAuth();
	const [inviteOpen, setInviteOpen] = useState(false);

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
				<Button onClick={() => setInviteOpen(true)}>
					<UserPlus className="size-4" aria-hidden />
					Invite person
				</Button>
			</div>

			<AccountList />

			<InviteAccountDialog open={inviteOpen} onOpenChange={setInviteOpen} />
		</section>
	);
}
