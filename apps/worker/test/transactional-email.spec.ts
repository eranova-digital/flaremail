import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/instance-settings/read");
vi.mock("../src/lib/mailbox-queries");
vi.mock("../src/lib/messages/outbound-persist");
vi.mock("../src/lib/messages/send-email");

import { sendTransactionalEmail } from "../src/lib/auth/transactional-email";
import { getPersistNoreplyOutboundEmails } from "../src/lib/instance-settings/read";
import { loadBlackholeMailboxForDomain } from "../src/lib/mailbox-queries";
import { sendAndPersistNewMessage } from "../src/lib/messages/outbound-persist";
import { sendEmail } from "../src/lib/messages/send-email";

describe("sendTransactionalEmail", () => {
	const db = {} as never;
	const deps = {
		email: { send: vi.fn() } as unknown as SendEmail,
		bucket: {} as R2Bucket,
		resolveIdentityForSend: vi.fn(async () => ({ fromName: "" })),
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
		vi.mocked(getPersistNoreplyOutboundEmails).mockResolvedValue(false);

		await sendTransactionalEmail(db, deps, input);

		expect(sendEmail).toHaveBeenCalledWith(
			deps.email,
			expect.objectContaining({
				from: "noreply@example.com",
				to: input.to,
				subject: input.subject,
				text: input.text,
			}),
		);
		expect(loadBlackholeMailboxForDomain).not.toHaveBeenCalled();
		expect(sendAndPersistNewMessage).not.toHaveBeenCalled();
	});

	it("persists to noreply sent when the setting is enabled", async () => {
		vi.mocked(getPersistNoreplyOutboundEmails).mockResolvedValue(true);
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
			expect.objectContaining({
				to: [input.to],
				subject: input.subject,
				text: input.text,
			}),
			expect.objectContaining({
				inReplyTo: null,
				references: null,
				isReply: false,
			}),
			"sent",
		);
		expect(sendEmail).not.toHaveBeenCalled();
	});

	it("falls back to direct send when noreply mailbox is missing", async () => {
		vi.mocked(getPersistNoreplyOutboundEmails).mockResolvedValue(true);
		vi.mocked(loadBlackholeMailboxForDomain).mockResolvedValue(null);

		await sendTransactionalEmail(db, deps, input);

		expect(sendEmail).toHaveBeenCalled();
		expect(sendAndPersistNewMessage).not.toHaveBeenCalled();
	});

	it("passes html through when provided", async () => {
		vi.mocked(getPersistNoreplyOutboundEmails).mockResolvedValue(false);

		await sendTransactionalEmail(db, deps, {
			...input,
			html: "<p>Hello</p>",
		});

		expect(sendEmail).toHaveBeenCalledWith(
			deps.email,
			expect.objectContaining({
				html: "<p>Hello</p>",
			}),
		);
	});
});
