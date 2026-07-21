import { and, desc, eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import {
	domainValidationChecks,
	domainValidationLogEvents,
	domainValidationRuns,
} from "../../db/schema";
import { CHECK_DEFINITIONS } from "./constants";
import { computeReadinessBadge } from "./compute-badge";
import type { CheckSnapshot } from "./types";
import {
	createValidationRunExecutor,
	ValidationRunExecutor,
} from "./validation-run-executor";

type RunDb = Pick<Database, "select" | "insert" | "update" | "transaction">;

export async function getActiveValidationRun(
	db: RunDb,
	domainId: string,
) {
	const [row] = await db
		.select()
		.from(domainValidationRuns)
		.where(
			and(
				eq(domainValidationRuns.domainId, domainId),
				eq(domainValidationRuns.status, "checking"),
			),
		)
		.limit(1);

	return row ?? null;
}

export async function loadRunChecks(
	db: RunDb,
	runId: string,
): Promise<CheckSnapshot[]> {
	const rows = await db
		.select({
			checkKey: domainValidationChecks.checkKey,
			tier: domainValidationChecks.tier,
			status: domainValidationChecks.status,
			code: domainValidationChecks.code,
			message: domainValidationChecks.message,
		})
		.from(domainValidationChecks)
		.where(eq(domainValidationChecks.runId, runId));

	return rows;
}

async function appendLog(
	db: RunDb,
	runId: string,
	event: {
		level: "info" | "warning" | "error";
		stage: "dns" | "send" | "receive" | "summary";
		code?: string;
		message: string;
		createdAt?: Date;
	},
): Promise<void> {
	await db.insert(domainValidationLogEvents).values({
		id: crypto.randomUUID(),
		runId,
		level: event.level,
		stage: event.stage,
		code: event.code ?? null,
		message: event.message,
		...(event.createdAt ? { createdAt: event.createdAt } : {}),
	});
}

export async function createValidationRun(
	db: Database,
	domainId: string,
): Promise<{ id: string; token: string } | null> {
	const active = await getActiveValidationRun(db, domainId);
	if (active) {
		return { id: active.id, token: active.token };
	}

	const runId = crypto.randomUUID();
	const token = crypto.randomUUID();
	const now = new Date();

	try {
		await db.transaction(async (tx) => {
			await tx.insert(domainValidationRuns).values({
				id: runId,
				domainId,
				status: "checking",
				badge: "checking",
				token,
				startedAt: now,
				createdAt: now,
				updatedAt: now,
			});

			await tx.insert(domainValidationChecks).values(
				CHECK_DEFINITIONS.map((definition) => ({
					id: crypto.randomUUID(),
					runId,
					checkKey: definition.checkKey,
					tier: definition.tier,
					status: "pending" as const,
				})),
			);

			await appendLog(tx, runId, {
				level: "info",
				stage: "summary",
				code: "run_started",
				message: "Domain validation run started",
			});
		});

		return { id: runId, token };
	} catch {
		const existing = await getActiveValidationRun(db, domainId);
		if (existing) {
			return { id: existing.id, token: existing.token };
		}
		throw new Error("Failed to create validation run");
	}
}

/**
 * Cancel an in-progress validation run. Skips remaining pending checks and
 * clears the active-run slot so a new recheck can start.
 */
export async function cancelValidationRun(
	db: Database,
	domainId: string,
	runId: string,
): Promise<void> {
	const [run] = await db
		.select()
		.from(domainValidationRuns)
		.where(eq(domainValidationRuns.id, runId))
		.limit(1);

	if (!run || run.domainId !== domainId) {
		throw new Error("Validation run not found");
	}

	if (run.status !== "checking") {
		throw new Error("Validation run is not in progress");
	}

	const now = new Date();

	await db.transaction(async (tx) => {
		await tx
			.update(domainValidationChecks)
			.set({
				status: "skipped",
				code: "cancelled",
				message: "Skipped because the validation run was cancelled",
				checkedAt: now,
			})
			.where(
				and(
					eq(domainValidationChecks.runId, runId),
					eq(domainValidationChecks.status, "pending"),
				),
			);

		const checks = await loadRunChecks(tx, runId);
		const badge = computeReadinessBadge("cancelled", checks);

		const updated = await tx
			.update(domainValidationRuns)
			.set({
				status: "cancelled",
				badge,
				finishedAt: now,
				updatedAt: now,
			})
			.where(
				and(
					eq(domainValidationRuns.id, runId),
					eq(domainValidationRuns.status, "checking"),
				),
			)
			.returning({ id: domainValidationRuns.id });

		if (updated.length === 0) {
			throw new Error("Validation run is not in progress");
		}

		await appendLog(tx, runId, {
			level: "info",
			stage: "summary",
			code: "run_cancelled",
			message: "Domain validation run cancelled",
		});
	});
}

export async function executeValidationRun(
	db: Database,
	email: SendEmail,
	_domainId: string,
	domainName: string,
	runId: string,
	token: string,
): Promise<void> {
	const executor = createValidationRunExecutor(db, runId);
	await executor.executeChecks(email, domainName, token);
}

export async function markValidationReceived(
	db: Database,
	runId: string,
): Promise<void> {
	await createValidationRunExecutor(db, runId).markReceived();
}

export async function processTimedOutValidationRuns(db: Database): Promise<number> {
	return ValidationRunExecutor.processTimedOutRuns(db);
}

export async function getLatestValidationRunForDomain(
	db: RunDb,
	domainId: string,
) {
	const [row] = await db
		.select()
		.from(domainValidationRuns)
		.where(eq(domainValidationRuns.domainId, domainId))
		.orderBy(desc(domainValidationRuns.startedAt))
		.limit(1);

	return row ?? null;
}

export async function findCheckingRunByToken(db: RunDb, token: string) {
	const [row] = await db
		.select()
		.from(domainValidationRuns)
		.where(
			and(
				eq(domainValidationRuns.token, token),
				eq(domainValidationRuns.status, "checking"),
			),
		)
		.limit(1);

	return row ?? null;
}

export async function findRunByToken(db: RunDb, token: string) {
	const [row] = await db
		.select()
		.from(domainValidationRuns)
		.where(eq(domainValidationRuns.token, token))
		.limit(1);

	return row ?? null;
}

export async function logStaleValidationEmail(
	db: RunDb,
	runId: string,
): Promise<void> {
	await appendLog(db, runId, {
		level: "warning",
		stage: "receive",
		code: "stale_validation_email_received",
		message: "Validation email arrived after run completed or timed out",
	});
}
