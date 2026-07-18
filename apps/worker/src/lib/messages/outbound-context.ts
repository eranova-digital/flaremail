import type { Database } from "../../db/client";
import type { Principal } from "../auth/types";
import type { LogContext } from "../logs/context";
import { parseLogContextFromRequest } from "../logs/request-context";

export type ResolveIdentityForSend = (
	db: Database,
	principal: Principal,
	mailboxId: string,
	identityId: string | undefined,
) => Promise<{ fromName: string }>;

export type OutboundContext = {
	db: Database;
	bucket: R2Bucket;
	email: SendEmail;
	principal: Principal;
	logContext?: LogContext | null;
	resolveIdentityForSend: ResolveIdentityForSend;
};

export function createOutboundContext(
	env: Env,
	db: Database,
	principal: Principal,
	resolveIdentityForSend: ResolveIdentityForSend,
	request?: Request,
): OutboundContext {
	return {
		db,
		bucket: env.BUCKET,
		email: env.EMAIL,
		principal,
		resolveIdentityForSend,
		logContext: request ? parseLogContextFromRequest(request) : null,
	};
}
