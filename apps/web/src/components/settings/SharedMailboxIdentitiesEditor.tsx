import { useTranslation } from "react-i18next";

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
	const { t } = useTranslation("management");
	const mailboxId = mailbox.id;
	const policyMutation = useUpdateMailboxIdentityPolicy(mailboxId ?? "");

	if (!mailboxId) {
		return null;
	}

	return (
		<div className="space-y-8">
			<section className="space-y-4">
				<div>
					<h2 className="text-base font-medium">
						{t("sharedMailboxUsers.identityPolicy.title")}
					</h2>
					<p className="text-muted-foreground text-sm">
						{t("sharedMailboxUsers.identityPolicy.description")}
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
							<p className="text-sm font-medium">
								{t("sharedMailboxUsers.identityPolicy.allowPersonal")}
							</p>
							<p className="text-muted-foreground text-sm">
								{t("sharedMailboxUsers.identityPolicy.allowPersonalDesc")}
							</p>
						</div>
						<Switch
							checked={mailbox.personalIdentityAllowance ?? false}
							disabled={policyMutation.isPending}
							onCheckedChange={(checked) =>
								policyMutation.mutate({ personalIdentityAllowance: checked })
							}
							aria-label={t("sharedMailboxUsers.identityPolicy.allowPersonal")}
						/>
					</div>
					<div className="flex items-start justify-between gap-4">
						<div className="space-y-1">
							<p className="text-sm font-medium">
								{t("sharedMailboxUsers.identityPolicy.export")}
							</p>
							<p className="text-muted-foreground text-sm">
								{t("sharedMailboxUsers.identityPolicy.exportDesc")}
							</p>
						</div>
						<Switch
							checked={mailbox.identityExport ?? false}
							disabled={policyMutation.isPending}
							onCheckedChange={(checked) =>
								policyMutation.mutate({ identityExport: checked })
							}
							aria-label={t("sharedMailboxUsers.identityPolicy.export")}
						/>
					</div>
				</div>
			</section>

			<MailboxIdentitiesManager
				mailboxId={mailboxId}
				mailboxAddress={mailbox.address}
				title={t("sharedMailboxUsers.mailboxIdentities.title")}
				description={t("sharedMailboxUsers.mailboxIdentities.description")}
				hideDefault
			/>
		</div>
	);
}
