import { desc, eq } from "drizzle-orm";

import type { Database } from "../db/client";
import {
	domainValidationChecks,
	domainValidationLogEvents,
	domainValidationRuns,
} from "../db/schema";
import {
	DomainValidationRun,
	getLatestValidationRunForDomain,
	loadRunChecks,
} from "../lib/domain-validation";
import {
	toDomainReadinessSummaryDto,
	toValidationCheckDto,
	toValidationLogEventDto,
	toValidationRunDetailDto,
	toValidationRunSummaryDto,
} from "./dto";

export async function getDomainReadinessSummary(db: Database, domainId: string) {
	const run = await getLatestValidationRunForDomain(db, domainId);
	if (!run) {
		return toDomainReadinessSummaryDto(null);
	}

	return toDomainReadinessSummaryDto(run);
}

export async function listValidationRuns(db: Database, domainId: string) {
	const rows = await db
		.select()
		.from(domainValidationRuns)
		.where(eq(domainValidationRuns.domainId, domainId))
		.orderBy(desc(domainValidationRuns.startedAt));

	return rows.map(toValidationRunSummaryDto);
}

export async function getValidationRunDetail(
	db: Database,
	domainId: string,
	runId: string,
) {
	const [run] = await db
		.select()
		.from(domainValidationRuns)
		.where(eq(domainValidationRuns.id, runId))
		.limit(1);

	if (!run || run.domainId !== domainId) {
		throw new Error("Validation run not found");
	}

	const checks = await db
		.select()
		.from(domainValidationChecks)
		.where(eq(domainValidationChecks.runId, runId));

	const logs = await db
		.select()
		.from(domainValidationLogEvents)
		.where(eq(domainValidationLogEvents.runId, runId))
		.orderBy(domainValidationLogEvents.createdAt);

	return toValidationRunDetailDto(
		run,
		checks.map(toValidationCheckDto),
		logs.map(toValidationLogEventDto),
	);
}

export async function startDomainValidation(
	db: Database,
	email: SendEmail,
	domainId: string,
	domainName: string,
) {
	const created = await DomainValidationRun.createRun(db, domainId);
	if (!created) {
		throw new Error("Failed to start validation run");
	}

	const activeBeforeExecute = await DomainValidationRun.getActiveRun(db, domainId);
	const shouldExecute =
		activeBeforeExecute?.id === created.id &&
		(await loadRunChecks(db, created.id)).every(
			(check) => check.status === "pending",
		);

	if (shouldExecute) {
		await DomainValidationRun.executeRun(
			db,
			email,
			domainId,
			domainName,
			created.id,
			created.token,
		);
	}

	return getValidationRunDetail(db, domainId, created.id);
}

export async function startOrReturnValidationRun(
	db: Database,
	email: SendEmail,
	domainId: string,
	domainName: string,
) {
	const active = await DomainValidationRun.getActiveRun(db, domainId);
	if (active) {
		return getValidationRunDetail(db, domainId, active.id);
	}

	return startDomainValidation(db, email, domainId, domainName);
}
