import type { Database } from "../db/client";
import type { Principal } from "../auth/types";

export type MailboxReadContext = {
	db: Database;
	bucket: R2Bucket;
	principal: Principal;
};

export function createMailboxReadContext(
	env: Env,
	db: Database,
	principal: Principal,
): MailboxReadContext {
	return {
		db,
		bucket: env.BUCKET,
		principal,
	};
}
