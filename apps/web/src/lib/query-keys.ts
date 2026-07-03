import type { ThreadFolder } from "@/lib/api/client";

export const queryKeys = {
	domains: ["domains"] as const,
	domainValidationRun: (domainId: string, runId: string) =>
		["domain-validation-run", domainId, runId] as const,
	domainValidationRuns: (domainId: string) =>
		["domain-validation-runs", domainId] as const,
	domain: (domainId: string) => ["domain", domainId] as const,
	mailboxes: ["mailboxes"] as const,
	threads: (mailboxId: string, folder: ThreadFolder, cursor?: string | null) =>
		["threads", mailboxId, folder, cursor ?? null] as const,
	thread: (mailboxId: string, threadId: string) =>
		["thread", mailboxId, threadId] as const,
	threadMessages: (mailboxId: string, threadId: string) =>
		["thread-messages", mailboxId, threadId] as const,
	message: (mailboxId: string, messageId: string) =>
		["message", mailboxId, messageId] as const,
	draft: (mailboxId: string, draftId: string) =>
		["draft", mailboxId, draftId] as const,
	rawMessage: (mailboxId: string, messageId: string) =>
		["raw-message", mailboxId, messageId] as const,
};
