import type { Database } from "../../db/client";
import { tryConsumeValidationInbound } from "./consume-inbound";
import {
	createValidationRun,
	executeValidationRun,
	getActiveValidationRun,
	getLatestValidationRunForDomain,
	processTimedOutValidationRuns,
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
};

export type DomainValidationDb = Database;
