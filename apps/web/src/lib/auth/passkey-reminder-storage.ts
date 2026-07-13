const STORAGE_KEY_PREFIX = "flaremail:passkey-reminder:";
export const PASSKEY_REMINDER_MAX_SHOWS = 4;
export const PASSKEY_REMINDER_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export type PasskeyReminderState = {
	showCount: number;
	lastShownAt: string;
};

function storageKey(accountId: string): string {
	return `${STORAGE_KEY_PREFIX}${accountId}`;
}

function readState(accountId: string): PasskeyReminderState | null {
	try {
		const raw = localStorage.getItem(storageKey(accountId));
		if (!raw) {
			return null;
		}
		const parsed = JSON.parse(raw) as Partial<PasskeyReminderState>;
		if (
			typeof parsed.showCount !== "number" ||
			typeof parsed.lastShownAt !== "string"
		) {
			return null;
		}
		return {
			showCount: parsed.showCount,
			lastShownAt: parsed.lastShownAt,
		};
	} catch {
		return null;
	}
}

function writeState(accountId: string, state: PasskeyReminderState): void {
	localStorage.setItem(storageKey(accountId), JSON.stringify(state));
}

export function shouldShowPasskeyReminder(
	accountId: string,
	now = Date.now(),
): boolean {
	const state = readState(accountId);
	if (!state) {
		return true;
	}
	if (state.showCount >= PASSKEY_REMINDER_MAX_SHOWS) {
		return false;
	}
	const lastShown = Date.parse(state.lastShownAt);
	if (Number.isNaN(lastShown)) {
		return true;
	}
	return now - lastShown >= PASSKEY_REMINDER_INTERVAL_MS;
}

export function recordPasskeyReminderShown(
	accountId: string,
	now = Date.now(),
): PasskeyReminderState {
	const state = readState(accountId);
	const next: PasskeyReminderState = {
		showCount: (state?.showCount ?? 0) + 1,
		lastShownAt: new Date(now).toISOString(),
	};
	writeState(accountId, next);
	return next;
}

export function readPasskeyReminderState(
	accountId: string,
): PasskeyReminderState | null {
	return readState(accountId);
}
