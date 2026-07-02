import type { Database } from "../../db/client";

export type OutboundContext = {
	db: Database;
	bucket: R2Bucket;
	email: SendEmail;
};

export function createOutboundContext(
	env: Env,
	db: Database,
): OutboundContext {
	return {
		db,
		bucket: env.BUCKET,
		email: env.EMAIL,
	};
}
