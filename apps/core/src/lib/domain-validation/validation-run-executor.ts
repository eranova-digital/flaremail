import { and, eq, inArray, lte } from "drizzle-orm";

import type { Database } from "../../db/client";
import {
	domainValidationChecks,
	domainValidationLogEvents,
	domainValidationRuns,
	domains,
} from "../../db/schema";
import { buildEmailAddress } from "../normalize-email-address";
import { sendEmail, EmailSendError } from "../messages/send-email";
import {
	SYSTEM_BLACKHOLE_LOCAL_PART,
	SYSTEM_POSTMASTER_LOCAL_PART,
} from "../system-mailboxes";
import { computeReadinessBadge } from "./compute-badge";
import {
	RECEIVE_TIMEOUT_MS,
	VALIDATION_EMAIL_SUBJECT,
	VALIDATION_TOKEN_HEADER,
} from "./constants";
import { checkDmarcRuaPostmaster, checkMxRecordsExist } from "./dns-checks";
import type { CheckOutcome, CheckSnapshot, ValidationCheckKey } from "./types";
import { buildValidationBodyText } from "./validation-body";

type RunDb = Pick<Database, "select" | "insert" | "update" | "transaction">;

async function loadRunChecks(
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

	const [run] = await db
		.select({ domainId: domainValidationRuns.domainId })
		.from(domainValidationRuns)
		.where(eq(domainValidationRuns.id, runId))
		.limit(1);

	await db
		.update(domainValidationRuns)
		.set({
			status: "completed",
			badge,
			finishedAt: now,
			updatedAt: now,
		})
		.where(eq(domainValidationRuns.id, runId));

	if (badge === "healthy" && run?.domainId) {
		await db
			.update(domains)
			.set({ isActive: true, updatedAt: now })
			.where(eq(domains.id, run.domainId));
	}

	await appendLog(db, runId, {
		level: badge === "healthy" ? "info" : badge === "unhealthy" ? "warning" : "error",
		stage: "summary",
		code: `run_${badge}`,
		message: `Validation run completed with badge: ${badge}`,
	});
}

/**
 * Executes a domain validation run through dns → send → await_receive → completed.
 */
export class ValidationRunExecutor {
	constructor(
		private readonly db: Database,
		private readonly runId: string,
	) {}

	async executeChecks(email: SendEmail, domainName: string, token: string) {
		let mxPassed = false;

		try {
			const mxResult = await checkMxRecordsExist(domainName);
			mxPassed = mxResult.passed;
			await setCheckOutcome(this.db, this.runId, "mx", {
				status: mxResult.passed ? "passed" : "failed",
				code: mxResult.code,
				message: mxResult.message,
			});
			await appendLog(this.db, this.runId, {
				level: mxResult.passed ? "info" : "error",
				stage: "dns",
				code: mxResult.code ?? "mx_ok",
				message: mxResult.message ?? "MX check completed",
			});
		} catch (error) {
			await setCheckOutcome(this.db, this.runId, "mx", {
				status: "failed",
				code: "mx_lookup_error",
				message: error instanceof Error ? error.message : "MX lookup failed",
			});
			await appendLog(this.db, this.runId, {
				level: "error",
				stage: "dns",
				code: "mx_lookup_error",
				message: error instanceof Error ? error.message : "MX lookup failed",
			});
		}

		try {
			const dmarcResult = await checkDmarcRuaPostmaster(domainName);
			await setCheckOutcome(this.db, this.runId, "dmarc_rua", {
				status: dmarcResult.passed ? "passed" : "failed",
				code: dmarcResult.code,
				message: dmarcResult.message,
			});
			await appendLog(this.db, this.runId, {
				level: dmarcResult.passed ? "info" : "warning",
				stage: "dns",
				code: dmarcResult.code ?? "dmarc_rua_ok",
				message: dmarcResult.message ?? "DMARC rua check completed",
			});
		} catch (error) {
			await setCheckOutcome(this.db, this.runId, "dmarc_rua", {
				status: "failed",
				code: "dmarc_lookup_error",
				message: error instanceof Error ? error.message : "DMARC lookup failed",
			});
			await appendLog(this.db, this.runId, {
				level: "warning",
				stage: "dns",
				code: "dmarc_lookup_error",
				message: error instanceof Error ? error.message : "DMARC lookup failed",
			});
		}

		if (!mxPassed) {
			await skipRemainingChecks(this.db, this.runId, ["loop_send", "loop_receive"]);
			await completeRun(this.db, this.runId);
			return;
		}

		const from = buildEmailAddress(SYSTEM_BLACKHOLE_LOCAL_PART, domainName);
		const to = buildEmailAddress(SYSTEM_POSTMASTER_LOCAL_PART, domainName);
		const bodyText = buildValidationBodyText(token);
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

			await setCheckOutcome(this.db, this.runId, "loop_send", {
				status: "passed",
				code: "loop_send_ok",
				message: `Sent validation email from ${from} to ${to}`,
			});
			await appendLog(this.db, this.runId, {
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

			await setCheckOutcome(this.db, this.runId, "loop_send", {
				status: "failed",
				code,
				message,
			});
			await appendLog(this.db, this.runId, {
				level: "error",
				stage: "send",
				code,
				message,
			});
			await skipRemainingChecks(this.db, this.runId, ["loop_receive"]);
			await completeRun(this.db, this.runId);
			return;
		}

		const deadline = new Date(Date.now() + RECEIVE_TIMEOUT_MS);
		await this.db
			.update(domainValidationRuns)
			.set({
				receiveDeadlineAt: deadline,
				updatedAt: new Date(),
			})
			.where(eq(domainValidationRuns.id, this.runId));

		await appendLog(this.db, this.runId, {
			level: "info",
			stage: "receive",
			code: "awaiting_loop_receive",
			message: `Waiting for validation email at ${to} until ${deadline.toISOString()}`,
			createdAt: new Date(sendStartedAt.getTime() + 1),
		});
	}

	async markReceived(): Promise<void> {
		const [run] = await this.db
			.select()
			.from(domainValidationRuns)
			.where(eq(domainValidationRuns.id, this.runId))
			.limit(1);

		if (!run || run.status !== "checking") {
			return;
		}

		await setCheckOutcome(this.db, this.runId, "loop_receive", {
			status: "passed",
			code: "loop_receive_ok",
			message: "Validation email received at postmaster",
		});
		await appendLog(this.db, this.runId, {
			level: "info",
			stage: "receive",
			code: "loop_receive_ok",
			message: "Validation email received at postmaster",
		});
		await completeRun(this.db, this.runId);
	}

	static async processTimedOutRuns(db: Database): Promise<number> {
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
			const executor = new ValidationRunExecutor(db, run.id);
			await executor.failReceiveTimeout();
		}

		return expiredRuns.length;
	}

	private async failReceiveTimeout(): Promise<void> {
		const checks = await loadRunChecks(this.db, this.runId);
		const receive = checks.find((check) => check.checkKey === "loop_receive");
		if (receive?.status !== "pending") {
			return;
		}

		await setCheckOutcome(this.db, this.runId, "loop_receive", {
			status: "failed",
			code: "receive_timeout",
			message: "Validation email did not arrive before deadline",
		});
		await appendLog(this.db, this.runId, {
			level: "error",
			stage: "receive",
			code: "receive_timeout",
			message: "Validation email did not arrive before deadline",
		});
		await completeRun(this.db, this.runId);
	}
}

export function createValidationRunExecutor(
	db: Database,
	runId: string,
): ValidationRunExecutor {
	return new ValidationRunExecutor(db, runId);
}
