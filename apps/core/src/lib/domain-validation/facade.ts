import type { Database } from "../../db/client";
import { tryConsumeValidationInbound } from "./consume-inbound";
import {
	getDomainReadinessSummary,
	getValidationRunDetail,
	listValidationRuns,
	startDomainValidation,
	startOrReturnValidationRun,
	cancelDomainValidationRun,
} from "./queries";
import {
	createValidationRun,
	executeValidationRun,
	getActiveValidationRun,
	getLatestValidationRunForDomain,
	processTimedOutValidationRuns,
	cancelValidationRun,
} from "./run-engine";

/**
 * Deep module for domain readiness runs — one lifecycle interface for
 * inbound email, cron ticks, and HTTP-triggered runs.
 */
export const DomainValidationRun = {
	onInboundEmail: tryConsumeValidationInbound,
	tickTimeouts: processTimedOutValidationRuns,
	getActiveRun: getActiveValidationRun,
	getLatestRun: getLatestValidationRunForDomain,
	createRun: createValidationRun,
	executeRun: executeValidationRun,
	cancelRun: cancelValidationRun,
	getReadinessSummary: getDomainReadinessSummary,
	listRuns: listValidationRuns,
	getRunDetail: getValidationRunDetail,
	startRun: startDomainValidation,
	startOrReturnRun: startOrReturnValidationRun,
	cancel: cancelDomainValidationRun,
};

export type DomainValidationDb = Database;
