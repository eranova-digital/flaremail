import type { Database } from "../../db/client";
import type { Principal } from "../auth/types";

export type OutboundContext = {
	db: Database;
	bucket: R2Bucket;
	email: SendEmail;
	principal: Principal;
};

export function createOutboundContext(
	env: Env,
	db: Database,
	principal: Principal,
): OutboundContext {
	return {
		db,
		bucket: env.BUCKET,
		email: env.EMAIL,
		principal,
	};
}
