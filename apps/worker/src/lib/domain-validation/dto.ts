export function toDomainReadinessSummaryDto(
	run: {
		id: string;
		badge: string;
		status: string;
		startedAt: Date;
		finishedAt: Date | null;
	} | null,
) {
	if (!run) {
		return {
			badge: null,
			latestRunId: null,
			latestRunStartedAt: null,
			latestRunFinishedAt: null,
		};
	}

	return {
		badge: run.badge,
		latestRunId: run.id,
		latestRunStartedAt: run.startedAt.toISOString(),
		latestRunFinishedAt: run.finishedAt?.toISOString() ?? null,
	};
}

export function toValidationCheckDto(check: {
	checkKey: string;
	tier: string;
	status: string;
	code: string | null;
	message: string | null;
	checkedAt: Date | null;
}) {
	return {
		checkKey: check.checkKey,
		tier: check.tier,
		status: check.status,
		code: check.code,
		message: check.message,
		checkedAt: check.checkedAt?.toISOString() ?? null,
	};
}

export function toValidationLogEventDto(event: {
	id: string;
	level: string;
	stage: string;
	code: string | null;
	message: string;
	createdAt: Date;
}) {
	return {
		id: event.id,
		level: event.level,
		stage: event.stage,
		code: event.code,
		message: event.message,
		createdAt: event.createdAt.toISOString(),
	};
}

export function toValidationRunSummaryDto(run: {
	id: string;
	status: string;
	badge: string;
	startedAt: Date;
	finishedAt: Date | null;
}) {
	return {
		id: run.id,
		status: run.status,
		badge: run.badge,
		startedAt: run.startedAt.toISOString(),
		finishedAt: run.finishedAt?.toISOString() ?? null,
	};
}

export function toValidationRunDetailDto(
	run: {
		id: string;
		domainId: string;
		status: string;
		badge: string;
		startedAt: Date;
		finishedAt: Date | null;
		receiveDeadlineAt: Date | null;
	},
	checks: ReturnType<typeof toValidationCheckDto>[],
	logs: ReturnType<typeof toValidationLogEventDto>[],
) {
	return {
		...toValidationRunSummaryDto(run),
		domainId: run.domainId,
		receiveDeadlineAt: run.receiveDeadlineAt?.toISOString() ?? null,
		checks,
		logs,
	};
}
