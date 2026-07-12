import { InviteAccountForm } from "@/components/settings/accounts/InviteAccountForm";
import { AccountList } from "@/components/settings/accounts/AccountList";
import { canAccessAccountsTab } from "@/lib/accounts/permissions";
import { useAuth } from "@/lib/auth/AuthProvider";

export function AccountsSection() {
	const { account } = useAuth();

	if (!canAccessAccountsTab(account)) {
		return (
			<p className="text-muted-foreground text-sm">
				You do not have permission to manage accounts.
			</p>
		);
	}

	return (
		<div className="space-y-6">
			<InviteAccountForm />
			<AccountList />
		</div>
	);
}
