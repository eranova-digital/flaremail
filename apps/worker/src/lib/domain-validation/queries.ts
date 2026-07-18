import { desc, eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import {
	domainValidationChecks,
	domainValidationLogEvents,
	domainValidationRuns,
} from "../../db/schema";
import type { LogContext } from "../logs/context";
import { safeEmitLog } from "../logs/emit";
import {
	toDomainReadinessSummaryDto,
	toValidationCheckDto,
	toValidationLogEventDto,
	toValidationRunDetailDto,
	toValidationRunSummaryDto,
} from "./dto";
import {
	createValidationRun,
	executeValidationRun,
	getActiveValidationRun,
	getLatestValidationRunForDomain,
	loadRunChecks,
} from "./run-engine";

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
	logMeta?: { actorAccountId?: string | null; context?: LogContext | null },
) {
	const created = await createValidationRun(db, domainId);
	if (!created) {
		throw new Error("Failed to start validation run");
	}

	const actorAccountId = logMeta?.actorAccountId ?? null;
	await safeEmitLog(db, {
		importance: 6,
		type: "domains",
		summary: actorAccountId
			? "{actor} started domain readiness validation for {domain}"
			: "Domain readiness validation started for {domain}",
		refs: {
			domain: { kind: "domain", id: domainId },
			...(actorAccountId
				? { actor: { kind: "account" as const, id: actorAccountId } }
				: {}),
		},
		actorAccountId,
		context: logMeta?.context ?? null,
	});

	const activeBeforeExecute = await getActiveValidationRun(db, domainId);
	const shouldExecute =
		activeBeforeExecute?.id === created.id &&
		(await loadRunChecks(db, created.id)).every(
			(check) => check.status === "pending",
		);

	if (shouldExecute) {
		await executeValidationRun(
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
	logMeta?: { actorAccountId?: string | null; context?: LogContext | null },
) {
	const active = await getActiveValidationRun(db, domainId);
	if (active) {
		return getValidationRunDetail(db, domainId, active.id);
	}

	return startDomainValidation(db, email, domainId, domainName, logMeta);
}
