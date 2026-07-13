import { describe, expect, it, beforeEach } from "vitest";

import {
	PASSKEY_REMINDER_INTERVAL_MS,
	PASSKEY_REMINDER_MAX_SHOWS,
	readPasskeyReminderState,
	recordPasskeyReminderShown,
	shouldShowPasskeyReminder,
} from "./passkey-reminder-storage";

const ACCOUNT_ID = "account-123";

describe("passkey reminder storage", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("shows the reminder when there is no prior state", () => {
		expect(shouldShowPasskeyReminder(ACCOUNT_ID)).toBe(true);
	});

	it("does not show again within a week", () => {
		const now = Date.parse("2026-07-13T12:00:00.000Z");
		recordPasskeyReminderShown(ACCOUNT_ID, now);

		expect(
			shouldShowPasskeyReminder(
				ACCOUNT_ID,
				now + PASSKEY_REMINDER_INTERVAL_MS - 1,
			),
		).toBe(false);
	});

	it("shows again after a week", () => {
		const now = Date.parse("2026-07-13T12:00:00.000Z");
		recordPasskeyReminderShown(ACCOUNT_ID, now);

		expect(
			shouldShowPasskeyReminder(
				ACCOUNT_ID,
				now + PASSKEY_REMINDER_INTERVAL_MS,
			),
		).toBe(true);
	});

	it("stops after four reminders", () => {
		const now = Date.parse("2026-07-13T12:00:00.000Z");
		for (let index = 0; index < PASSKEY_REMINDER_MAX_SHOWS; index += 1) {
			recordPasskeyReminderShown(
				ACCOUNT_ID,
				now + index * PASSKEY_REMINDER_INTERVAL_MS,
			);
		}

		expect(readPasskeyReminderState(ACCOUNT_ID)?.showCount).toBe(
			PASSKEY_REMINDER_MAX_SHOWS,
		);
		expect(
			shouldShowPasskeyReminder(
				ACCOUNT_ID,
				now + PASSKEY_REMINDER_MAX_SHOWS * PASSKEY_REMINDER_INTERVAL_MS,
			),
		).toBe(false);
	});
});
