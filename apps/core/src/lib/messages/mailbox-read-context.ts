import type { Database } from "../../db/client";
import type { Principal } from "../auth/types";
import type { LogContext } from "../logs/context";
import { parseLogContextFromRequest } from "../logs/request-context";

export type MailboxReadContext = {
	db: Database;
	bucket: R2Bucket;
	principal: Principal;
	logContext?: LogContext | null;
};

export function createMailboxReadContext(
	env: Env,
	db: Database,
	principal: Principal,
	request?: Request,
): MailboxReadContext {
	return {
		db,
		bucket: env.BUCKET,
		principal,
		logContext: request ? parseLogContextFromRequest(request) : null,
	};
}
