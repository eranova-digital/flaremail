import { and, desc, eq, inArray, lte } from "drizzle-orm";

import type { Database } from "../../db/client";
import {
	domainValidationChecks,
	domainValidationLogEvents,
	domainValidationRuns,
} from "../../db/schema";
import { computeReadinessBadge } from "./compute-badge";
import {
	CHECK_DEFINITIONS,
	RECEIVE_TIMEOUT_MS,
	VALIDATION_EMAIL_SUBJECT,
	VALIDATION_TOKEN_HEADER,
} from "./constants";
import { checkDmarcRuaPostmaster, checkMxRecordsExist } from "./dns-checks";
import type { CheckOutcome, CheckSnapshot, ValidationCheckKey } from "./types";
import { buildValidationBodyText } from "./validation-body";
import { buildEmailAddress } from "../normalize-email-address";
import {
	SYSTEM_ALIAS_LOCAL_PARTS,
	SYSTEM_POSTMASTER_LOCAL_PART,
} from "../system-mailboxes";
import { sendEmail, EmailSendError } from "../messages/send-email";

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

async function setCheckOutcome(
	db: RunDb,
	runId: string,
	checkKey: ValidationCheckKey,
	outcome: CheckOutcome,
): Promise<void> {
	const now = new Date();
	await db
		.update(domainValidationChecks)
		.set({
			status: outcome.status,
			code: outcome.code ?? null,
			message: outcome.message ?? null,
			checkedAt: now,
		})
		.where(
			and(
				eq(domainValidationChecks.runId, runId),
				eq(domainValidationChecks.checkKey, checkKey),
			),
		);
}

async function skipRemainingChecks(
	db: RunDb,
	runId: string,
	checkKeys: ValidationCheckKey[],
): Promise<void> {
	if (!checkKeys.length) {
		return;
	}

	const now = new Date();
	await db
		.update(domainValidationChecks)
		.set({
			status: "skipped",
			checkedAt: now,
		})
		.where(
			and(
				eq(domainValidationChecks.runId, runId),
				inArray(domainValidationChecks.checkKey, checkKeys),
				eq(domainValidationChecks.status, "pending"),
			),
		);
}

async function completeRun(db: RunDb, runId: string): Promise<void> {
	const checks = await loadRunChecks(db, runId);
	const badge = computeReadinessBadge("completed", checks);
	const now = new Date();

	await db
		.update(domainValidationRuns)
		.set({
			status: "completed",
			badge,
			finishedAt: now,
			updatedAt: now,
		})
		.where(eq(domainValidationRuns.id, runId));

	await appendLog(db, runId, {
		level: badge === "healthy" ? "info" : badge === "unhealthy" ? "warning" : "error",
		stage: "summary",
		code: `run_${badge}`,
		message: `Validation run completed with badge: ${badge}`,
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

export async function executeValidationRun(
	db: Database,
	email: SendEmail,
	domainId: string,
	domainName: string,
	runId: string,
	token: string,
): Promise<void> {
	let mxPassed = false;

	try {
		const mxResult = await checkMxRecordsExist(domainName);
		mxPassed = mxResult.passed;
		await setCheckOutcome(db, runId, "mx", {
			status: mxResult.passed ? "passed" : "failed",
			code: mxResult.code,
			message: mxResult.message,
		});
		await appendLog(db, runId, {
			level: mxResult.passed ? "info" : "error",
			stage: "dns",
			code: mxResult.code ?? "mx_ok",
			message: mxResult.message ?? "MX check completed",
		});
	} catch (error) {
		await setCheckOutcome(db, runId, "mx", {
			status: "failed",
			code: "mx_lookup_error",
			message: error instanceof Error ? error.message : "MX lookup failed",
		});
		await appendLog(db, runId, {
			level: "error",
			stage: "dns",
			code: "mx_lookup_error",
			message: error instanceof Error ? error.message : "MX lookup failed",
		});
	}

	try {
		const dmarcResult = await checkDmarcRuaPostmaster(domainName);
		await setCheckOutcome(db, runId, "dmarc_rua", {
			status: dmarcResult.passed ? "passed" : "failed",
			code: dmarcResult.code,
			message: dmarcResult.message,
		});
		await appendLog(db, runId, {
			level: dmarcResult.passed ? "info" : "warning",
			stage: "dns",
			code: dmarcResult.code ?? "dmarc_rua_ok",
			message: dmarcResult.message ?? "DMARC rua check completed",
		});
	} catch (error) {
		await setCheckOutcome(db, runId, "dmarc_rua", {
			status: "failed",
			code: "dmarc_lookup_error",
			message: error instanceof Error ? error.message : "DMARC lookup failed",
		});
		await appendLog(db, runId, {
			level: "warning",
			stage: "dns",
			code: "dmarc_lookup_error",
			message: error instanceof Error ? error.message : "DMARC lookup failed",
		});
	}

	if (!mxPassed) {
		await skipRemainingChecks(db, runId, ["loop_send", "loop_receive"]);
		await completeRun(db, runId);
		return;
	}

	const from = buildEmailAddress(SYSTEM_ALIAS_LOCAL_PARTS[1], domainName);
	const to = buildEmailAddress(SYSTEM_POSTMASTER_LOCAL_PART, domainName);
	const bodyText = buildValidationBodyText(token);

	// Captured before dispatch so send-stage logs sort before the receive logs,
	// which may be written by a concurrent inbound invocation while the loop email
	// round-trips faster than this send call resolves.
	const sendStartedAt = new Date();

	try {
		await sendEmail(email, {
			from,
			to,
			subject: VALIDATION_EMAIL_SUBJECT,
			text: bodyText,
			headers: {
				[VALIDATION_TOKEN_HEADER]: token,
			},
		});

		await setCheckOutcome(db, runId, "loop_send", {
			status: "passed",
			code: "loop_send_ok",
			message: `Sent validation email from ${from} to ${to}`,
		});
		await appendLog(db, runId, {
			level: "info",
			stage: "send",
			code: "loop_send_ok",
			message: `Sent validation email from ${from} to ${to}`,
			createdAt: sendStartedAt,
		});
	} catch (error) {
		const code =
			error instanceof EmailSendError ? error.code : "loop_send_failed";
		const message =
			error instanceof Error ? error.message : "Sending validation email failed";

		await setCheckOutcome(db, runId, "loop_send", {
			status: "failed",
			code,
			message,
		});
		await appendLog(db, runId, {
			level: "error",
			stage: "send",
			code,
			message,
		});
		await skipRemainingChecks(db, runId, ["loop_receive"]);
		await completeRun(db, runId);
		return;
	}

	const deadline = new Date(Date.now() + RECEIVE_TIMEOUT_MS);
	await db
		.update(domainValidationRuns)
		.set({
			receiveDeadlineAt: deadline,
			updatedAt: new Date(),
		})
		.where(eq(domainValidationRuns.id, runId));

	await appendLog(db, runId, {
		level: "info",
		stage: "receive",
		code: "awaiting_loop_receive",
		message: `Waiting for validation email at ${to} until ${deadline.toISOString()}`,
		createdAt: new Date(sendStartedAt.getTime() + 1),
	});
}

export async function markValidationReceived(
	db: Database,
	runId: string,
): Promise<void> {
	const [run] = await db
		.select()
		.from(domainValidationRuns)
		.where(eq(domainValidationRuns.id, runId))
		.limit(1);

	if (!run || run.status !== "checking") {
		return;
	}

	await setCheckOutcome(db, runId, "loop_receive", {
		status: "passed",
		code: "loop_receive_ok",
		message: "Validation email received at postmaster",
	});
	await appendLog(db, runId, {
		level: "info",
		stage: "receive",
		code: "loop_receive_ok",
		message: "Validation email received at postmaster",
	});
	await completeRun(db, runId);
}

export async function processTimedOutValidationRuns(db: Database): Promise<number> {
	const now = new Date();
	const expiredRuns = await db
		.select({ id: domainValidationRuns.id })
		.from(domainValidationRuns)
		.where(
			and(
				eq(domainValidationRuns.status, "checking"),
				lte(domainValidationRuns.receiveDeadlineAt, now),
			),
		);

	for (const run of expiredRuns) {
		const checks = await loadRunChecks(db, run.id);
		const receive = checks.find((check) => check.checkKey === "loop_receive");
		if (receive?.status !== "pending") {
			continue;
		}

		await setCheckOutcome(db, run.id, "loop_receive", {
			status: "failed",
			code: "receive_timeout",
			message: "Validation email did not arrive before deadline",
		});
		await appendLog(db, run.id, {
			level: "error",
			stage: "receive",
			code: "receive_timeout",
			message: "Validation email did not arrive before deadline",
		});
		await completeRun(db, run.id);
	}

	return expiredRuns.length;
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
