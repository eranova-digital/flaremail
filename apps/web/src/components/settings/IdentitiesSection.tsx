import { Alert } from "@/components/ui/alert";
import { MailboxIdentitiesManager } from "@/components/settings/MailboxIdentitiesManager";
import { useAuth } from "@/lib/auth/AuthProvider";

export function IdentitiesSection() {
	const { account } = useAuth();
	const mailboxId = account?.primaryMailboxId ?? null;

	if (!mailboxId) {
		return (
			<Alert>
				Identities are available for accounts with a primary mailbox.
			</Alert>
		);
	}

	return (
		<MailboxIdentitiesManager
			mailboxId={mailboxId}
			title="Identities"
			description="Choose how your name and signature appear when sending from your primary address. The From address always stays your mailbox."
		/>
	);
}
