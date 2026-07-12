import type { OutboundContext } from "./outbound-context";
import { authorizeMailboxAccess } from "../auth/access";

export async function assertOutboundMailboxAccess(
	ctx: OutboundContext,
	mailboxId: string,
): Promise<void> {
	await authorizeMailboxAccess(ctx.db, ctx.principal, mailboxId);
}
