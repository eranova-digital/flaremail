import type { Database } from "../../db/client";
import {
	parseLogContextFromRequest,
	type LogContext,
} from "../../services/logs";
import type { Principal } from "../auth/types";

export type OutboundContext = {
	db: Database;
	bucket: R2Bucket;
	email: SendEmail;
	principal: Principal;
	logContext?: LogContext | null;
};

export function createOutboundContext(
	env: Env,
	db: Database,
	principal: Principal,
	request?: Request,
): OutboundContext {
	return {
		db,
		bucket: env.BUCKET,
		email: env.EMAIL,
		principal,
		logContext: request ? parseLogContextFromRequest(request) : null,
	};
}
