const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const RELATIVE_DURATION = /^(\d+)([dwmy])$/i;

export function isValidSearchDateValue(value: string): boolean {
	try {
		resolveSearchDateBound(value, new Date(), "since");
		return true;
	} catch {
		return false;
	}
}

export function resolveSearchDateBound(
	value: string,
	now: Date,
	bound: "since" | "until",
): Date {
	const trimmed = value.trim();
	const lower = trimmed.toLowerCase();

	if (lower === "today") {
		return utcDayBound(now, 0, bound);
	}
	if (lower === "yesterday") {
		return utcDayBound(now, -1, bound);
	}

	const duration = RELATIVE_DURATION.exec(lower);
	if (duration) {
		const amount = Number(duration[1]);
		if (!Number.isSafeInteger(amount) || amount < 1) {
			throw new Error("Invalid search date");
		}
		return subtractDuration(now, amount, duration[2].toLowerCase());
	}

	const day = DATE_ONLY.exec(trimmed);
	if (day) {
		const year = Number(day[1]);
		const month = Number(day[2]);
		const date = Number(day[3]);
		const utc = new Date(Date.UTC(year, month - 1, date));
		if (
			utc.getUTCFullYear() !== year ||
			utc.getUTCMonth() !== month - 1 ||
			utc.getUTCDate() !== date
		) {
			throw new Error("Invalid search date");
		}
		return bound === "since"
			? new Date(Date.UTC(year, month - 1, date, 0, 0, 0, 0))
			: new Date(Date.UTC(year, month - 1, date, 23, 59, 59, 999));
	}

	const instant = new Date(trimmed);
	if (Number.isNaN(instant.getTime())) {
		throw new Error("Invalid search date");
	}
	return instant;
}

function utcDayBound(now: Date, dayOffset: number, bound: "since" | "until"): Date {
	const year = now.getUTCFullYear();
	const month = now.getUTCMonth();
	const date = now.getUTCDate() + dayOffset;
	return bound === "since"
		? new Date(Date.UTC(year, month, date, 0, 0, 0, 0))
		: new Date(Date.UTC(year, month, date, 23, 59, 59, 999));
}

function subtractDuration(now: Date, amount: number, unit: string): Date {
	if (unit === "d") {
		return new Date(now.getTime() - amount * 24 * 60 * 60 * 1000);
	}
	if (unit === "w") {
		return new Date(now.getTime() - amount * 7 * 24 * 60 * 60 * 1000);
	}
	const copy = new Date(now.getTime());
	if (unit === "m") {
		copy.setUTCMonth(copy.getUTCMonth() - amount);
		return copy;
	}
	copy.setUTCFullYear(copy.getUTCFullYear() - amount);
	return copy;
}
