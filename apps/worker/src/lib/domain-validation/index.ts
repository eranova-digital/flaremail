/** Public entry for DomainValidationRun — import internals from their modules. */
export { DomainValidationRun } from "./facade";
export type { DomainValidationDb } from "./facade";
export {
	getDomainReadinessSummary,
	getValidationRunDetail,
	listValidationRuns,
	startDomainValidation,
	startOrReturnValidationRun,
} from "./queries";
export type { DomainReadinessBadge, CheckSnapshot } from "./types";
