import { describe, expect, it } from "vitest";

import { ComposeSendController } from "./compose-send-controller";

function createController(
	overrides: Partial<ConstructorParameters<typeof ComposeSendController>[0]> = {},
) {
	return new ComposeSendController({
		mailboxId: "mb-1",
		draftId: null,
		flushPendingSave: async () => {},
		getFields: () => ({
			to: "a@b.com",
			cc: "",
			bcc: "",
			subject: "Hi",
			body: "Hello",
			bodyHtml: "<p>Hello</p>",
			identityId: null,
		}),
		getAttachments: () => [],
		getAttachmentsDirty: () => false,
		setDraftId: () => {},
		setAttachmentsDirty: () => {},
		createDraft: async () => ({ id: "draft-1" }),
		updateDraft: async () => ({}),
		sendDraft: async () => ({ id: "msg-1", threadId: "thread-1" }),
		forwardToMessage: async () => ({ id: "msg-2", threadId: "thread-2" }),
		persistDraft: async () => ({
			ok: true as const,
			draftId: "draft-1",
			attachmentsDirty: false as const,
		}),
		withPendingSend: async (_threadId, _draftId, _preview, sendFn) => sendFn(),
		...overrides,
	});
}

describe("ComposeSendController", () => {
	it("starts in idle phase", () => {
		const controller = createController();
		expect(controller.currentPhase).toBe("idle");
		expect(controller.isBusy).toBe(false);
	});

	it("rejects concurrent send", async () => {
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});

		const controller = createController({
			flushPendingSave: async () => {
				await gate;
			},
		});

		const first = controller.send();
		await expect(controller.send()).rejects.toThrow("Send already in progress");
		release();
		await expect(first).resolves.toEqual({ id: "msg-1", threadId: "thread-1" });
	});
});
