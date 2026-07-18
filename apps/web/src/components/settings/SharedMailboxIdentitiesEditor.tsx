import { Alert } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { MailboxIdentitiesManager } from "@/components/settings/MailboxIdentitiesManager";
import { useUpdateMailboxIdentityPolicy } from "@/hooks/use-identities";
import { getErrorMessage } from "@/lib/api/errors";
import type { Mailbox } from "@/lib/api/client";

type SharedMailboxIdentitiesEditorProps = {
	mailbox: Mailbox;
};

export function SharedMailboxIdentitiesEditor({
	mailbox,
}: SharedMailboxIdentitiesEditorProps) {
	const mailboxId = mailbox.id;
	const policyMutation = useUpdateMailboxIdentityPolicy(mailboxId ?? "");

	if (!mailboxId) {
		return null;
	}

	return (
		<div className="space-y-8">
			<section className="space-y-4">
				<div>
					<h2 className="text-base font-medium">Identity policy</h2>
					<p className="text-muted-foreground text-sm">
						Control which send personas appear when composing from this mailbox
						or elsewhere. From address always stays the active mailbox.
					</p>
				</div>
				{policyMutation.isError ? (
					<Alert tone="destructive">
						{getErrorMessage(policyMutation.error)}
					</Alert>
				) : null}
				<div className="space-y-4 rounded-xl border p-4">
					<div className="flex items-start justify-between gap-4">
						<div className="space-y-1">
							<p className="text-sm font-medium">Allow personal identities</p>
							<p className="text-muted-foreground text-sm">
								When sending from this mailbox, offer identities from the
								sender&apos;s primary mailbox.
							</p>
						</div>
						<Switch
							checked={mailbox.personalIdentityAllowance ?? false}
							disabled={policyMutation.isPending}
							onCheckedChange={(checked) =>
								policyMutation.mutate({ personalIdentityAllowance: checked })
							}
							aria-label="Allow personal identities"
						/>
					</div>
					<div className="flex items-start justify-between gap-4">
						<div className="space-y-1">
							<p className="text-sm font-medium">Export identities</p>
							<p className="text-muted-foreground text-sm">
								Allow this mailbox&apos;s identities to be selected when
								sending from other mailboxes the account can access.
							</p>
						</div>
						<Switch
							checked={mailbox.identityExport ?? false}
							disabled={policyMutation.isPending}
							onCheckedChange={(checked) =>
								policyMutation.mutate({ identityExport: checked })
							}
							aria-label="Export identities"
						/>
					</div>
				</div>
			</section>

			<MailboxIdentitiesManager
				mailboxId={mailboxId}
				mailboxAddress={mailbox.address}
				title="Mailbox identities"
				description="Name patterns and signatures owned by this shared mailbox."
				hideDefault
			/>
		</div>
	);
}
