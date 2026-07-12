import { authorizeMailbox } from "../auth/access";
import type { MailboxReadContext } from "./mailbox-read-context";

export async function assertMailboxReadAccess(
	ctx: MailboxReadContext,
	mailboxId: string,
): Promise<void> {
	await authorizeMailbox(ctx.db, ctx.principal, mailboxId, "read");
}
