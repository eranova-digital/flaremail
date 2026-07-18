import type { ThreadFolder } from "@/lib/api/client";

export const queryKeys = {
	domains: ["domains"] as const,
	domainValidationRun: (domainId: string, runId: string) =>
		["domain-validation-run", domainId, runId] as const,
	domainValidationRuns: (domainId: string) =>
		["domain-validation-runs", domainId] as const,
	domain: (domainId: string) => ["domain", domainId] as const,
	mailboxes: ["mailboxes"] as const,
	labels: (mailboxId: string) => ["labels", mailboxId] as const,
	threads: (mailboxId: string, folder: ThreadFolder, cursor?: string | null) =>
		["threads", mailboxId, folder, cursor ?? null] as const,
	threadsByLabel: (
		mailboxId: string,
		labelId: string,
		folder: ThreadFolder,
	) => ["threads-by-label", mailboxId, labelId, folder] as const,
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
	composeTemplates: (mailboxId: string) =>
		["templates", "compose", mailboxId] as const,
	manageableTemplates: ["templates", "manage"] as const,
};
