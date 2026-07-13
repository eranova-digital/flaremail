import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendTransactionalEmail } from "../src/lib/auth/transactional-email";

const getInstanceSettings = vi.fn();
const loadBlackholeMailboxForDomain = vi.fn();
const sendAndPersistNewMessage = vi.fn();
const sendEmail = vi.fn();

vi.mock(
	fileURLToPath(new URL("../src/services/instance-settings.ts", import.meta.url)),
	() => ({
		getInstanceSettings: (...args: unknown[]) => getInstanceSettings(...args),
	}),
);

vi.mock(
	fileURLToPath(new URL("../src/lib/mailbox-queries.ts", import.meta.url)),
	() => ({
		loadBlackholeMailboxForDomain: (...args: unknown[]) =>
			loadBlackholeMailboxForDomain(...args),
	}),
);

vi.mock(
	fileURLToPath(new URL("../src/lib/messages/outbound-persist.ts", import.meta.url)),
	() => ({
		sendAndPersistNewMessage: (...args: unknown[]) =>
			sendAndPersistNewMessage(...args),
	}),
);

vi.mock(
	fileURLToPath(new URL("../src/lib/messages/send-email.ts", import.meta.url)),
	() => ({
		sendEmail: (...args: unknown[]) => sendEmail(...args),
	}),
);

describe("sendTransactionalEmail", () => {
	const db = {} as never;
	const deps = {
		email: { send: vi.fn() } as unknown as SendEmail,
		bucket: {} as R2Bucket,
	};
	const input = {
		domainName: "example.com",
		to: "user@example.org",
		subject: "Test subject",
		text: "Test body",
	};

	beforeEach(() => {
		vi.clearAllMocks();
		sendEmail.mockResolvedValue({ messageId: "<test@example.com>" });
		sendAndPersistNewMessage.mockResolvedValue({ id: "message-id" });
	});

	it("sends without persisting when the setting is disabled", async () => {
		getInstanceSettings.mockResolvedValue({
			persistNoreplyOutboundEmails: false,
		});

		await sendTransactionalEmail(db, deps, input);

		expect(sendEmail).toHaveBeenCalledWith(deps.email, {
			from: "noreply@example.com",
			to: input.to,
			subject: input.subject,
			text: input.text,
		});
		expect(loadBlackholeMailboxForDomain).not.toHaveBeenCalled();
		expect(sendAndPersistNewMessage).not.toHaveBeenCalled();
	});

	it("persists to noreply sent when the setting is enabled", async () => {
		getInstanceSettings.mockResolvedValue({
			persistNoreplyOutboundEmails: true,
		});
		loadBlackholeMailboxForDomain.mockResolvedValue({
			id: "noreply-mailbox-id",
			address: "noreply@example.com",
			domain: "example.com",
			type: "blackhole",
		});

		await sendTransactionalEmail(db, deps, input);

		expect(sendAndPersistNewMessage).toHaveBeenCalledWith(
			expect.objectContaining({
				db,
				bucket: deps.bucket,
				email: deps.email,
			}),
			"noreply-mailbox-id",
			{
				to: [input.to],
				subject: input.subject,
				text: input.text,
			},
			expect.objectContaining({
				inReplyTo: null,
				references: null,
			}),
			"sent",
		);
		expect(sendEmail).not.toHaveBeenCalled();
	});

	it("falls back to send-only when persistence is enabled but noreply is missing", async () => {
		getInstanceSettings.mockResolvedValue({
			persistNoreplyOutboundEmails: true,
		});
		loadBlackholeMailboxForDomain.mockResolvedValue(null);

		await sendTransactionalEmail(db, deps, input);

		expect(sendEmail).toHaveBeenCalledWith(deps.email, {
			from: "noreply@example.com",
			to: input.to,
			subject: input.subject,
			text: input.text,
		});
		expect(sendAndPersistNewMessage).not.toHaveBeenCalled();
	});
});
