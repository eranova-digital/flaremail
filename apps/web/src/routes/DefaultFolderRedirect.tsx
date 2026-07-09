import { Navigate, useParams } from "react-router-dom";

import { useMailboxes } from "@/hooks/use-mailboxes";
import { getDefaultFolderForMailbox } from "@/lib/mailbox-folders";

export function DefaultFolderRedirect() {
	const { mailboxId } = useParams();
	const mailboxesQuery = useMailboxes();
	const mailbox = mailboxesQuery.data?.find((item) => item.id === mailboxId);

	return (
		<Navigate
			to={getDefaultFolderForMailbox(mailbox ?? {})}
			replace
		/>
	);
}
