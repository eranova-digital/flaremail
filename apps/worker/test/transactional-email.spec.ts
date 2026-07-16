import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/services/instance-settings");
vi.mock("../src/lib/mailbox-queries");
vi.mock("../src/lib/messages/outbound-persist");
vi.mock("../src/lib/messages/send-email");

import { sendTransactionalEmail } from "../src/lib/auth/transactional-email";
import { loadBlackholeMailboxForDomain } from "../src/lib/mailbox-queries";
import { sendAndPersistNewMessage } from "../src/lib/messages/outbound-persist";
import { sendEmail } from "../src/lib/messages/send-email";
import { getInstanceSettings } from "../src/services/instance-settings";

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
		vi.mocked(sendEmail).mockResolvedValue({ messageId: "<test@example.com>" });
		vi.mocked(sendAndPersistNewMessage).mockResolvedValue({ id: "message-id" });
	});

	it("sends without persisting when the setting is disabled", async () => {
		vi.mocked(getInstanceSettings).mockResolvedValue({
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
		vi.mocked(getInstanceSettings).mockResolvedValue({
			persistNoreplyOutboundEmails: true,
		});
		vi.mocked(loadBlackholeMailboxForDomain).mockResolvedValue({
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
				isReply: false,
			}),
			"sent",
		);
		expect(sendEmail).not.toHaveBeenCalled();
	});

	it("falls back to send-only when persistence is enabled but noreply is missing", async () => {
		vi.mocked(getInstanceSettings).mockResolvedValue({
			persistNoreplyOutboundEmails: true,
		});
		vi.mocked(loadBlackholeMailboxForDomain).mockResolvedValue(null);

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
