import type { RouteDefinition } from "../../lib/http/router";
import {
	handleCreateDomain,
	handleDeleteDomain,
	handleGetDomain,
	handleListDomains,
	handleUpdateDomain,
} from "../../controllers/domains";
import {
	handleCreateValidationRun,
	handleGetValidationRun,
	handleListValidationRuns,
} from "../../controllers/domain-validation";
import {
	handleCreateMailbox,
	handleDeleteMailbox,
	handleGetMailbox,
	handleListMailboxes,
	handleUpdateMailbox,
} from "../../controllers/mailboxes";
import {
	handleCreateDraft,
	handleDeleteDraft,
	handleForwardToMessage,
	handleReplyToMessage,
	handleSendDraft,
	handleSendMessage,
	handleUpdateDraft,
} from "../../controllers/messages";
import {
	handleCreateLabel,
	handleDeleteLabel,
	handleDownloadAttachment,
	handleDownloadRawMessage,
	handleGetLabel,
	handleGetMessage,
	handleGetMessagePreview,
	handleGetThread,
	handleListLabels,
	handleListThreadMessages,
	handleListThreads,
	handlePatchThread,
	handleSearch,
	handleThreadAction,
	handleUpdateLabel,
} from "../../controllers/reads";

const prefix = "/api/v1";

export const v1Routes: RouteDefinition[] = [
	{ method: "GET", path: `${prefix}/domains`, handler: handleListDomains },
	{ method: "POST", path: `${prefix}/domains`, handler: handleCreateDomain },
	{ method: "GET", path: `${prefix}/domains/:id`, handler: handleGetDomain },
	{ method: "PATCH", path: `${prefix}/domains/:id`, handler: handleUpdateDomain },
	{ method: "DELETE", path: `${prefix}/domains/:id`, handler: handleDeleteDomain },
	{
		method: "GET",
		path: `${prefix}/domains/:id/validation-runs`,
		handler: handleListValidationRuns,
	},
	{
		method: "POST",
		path: `${prefix}/domains/:id/validation-runs`,
		handler: handleCreateValidationRun,
	},
	{
		method: "GET",
		path: `${prefix}/domains/:id/validation-runs/:runId`,
		handler: handleGetValidationRun,
	},

	{ method: "GET", path: `${prefix}/mailboxes`, handler: handleListMailboxes },
	{ method: "POST", path: `${prefix}/mailboxes`, handler: handleCreateMailbox },
	{ method: "GET", path: `${prefix}/mailboxes/:id`, handler: handleGetMailbox },
	{
		method: "PATCH",
		path: `${prefix}/mailboxes/:id`,
		handler: handleUpdateMailbox,
	},
	{
		method: "DELETE",
		path: `${prefix}/mailboxes/:id`,
		handler: handleDeleteMailbox,
	},

	{
		method: "GET",
		path: `${prefix}/mailboxes/:mailboxId/labels`,
		handler: handleListLabels,
	},
	{
		method: "POST",
		path: `${prefix}/mailboxes/:mailboxId/labels`,
		handler: handleCreateLabel,
	},
	{
		method: "GET",
		path: `${prefix}/mailboxes/:mailboxId/labels/:id`,
		handler: handleGetLabel,
	},
	{
		method: "PATCH",
		path: `${prefix}/mailboxes/:mailboxId/labels/:id`,
		handler: handleUpdateLabel,
	},
	{
		method: "DELETE",
		path: `${prefix}/mailboxes/:mailboxId/labels/:id`,
		handler: handleDeleteLabel,
	},

	{ method: "POST", path: `${prefix}/messages/send`, handler: handleSendMessage },
	{ method: "POST", path: `${prefix}/messages/drafts`, handler: handleCreateDraft },
	{
		method: "PATCH",
		path: `${prefix}/messages/drafts/:id`,
		handler: handleUpdateDraft,
	},
	{
		method: "DELETE",
		path: `${prefix}/messages/drafts/:id`,
		handler: handleDeleteDraft,
	},
	{
		method: "POST",
		path: `${prefix}/messages/drafts/:id/send`,
		handler: handleSendDraft,
	},
	{
		method: "POST",
		path: `${prefix}/messages/:id/reply`,
		handler: handleReplyToMessage,
	},
	{
		method: "POST",
		path: `${prefix}/messages/:id/forward`,
		handler: handleForwardToMessage,
	},
	{
		method: "GET",
		path: `${prefix}/messages/:id/preview`,
		handler: handleGetMessagePreview,
	},
	{
		method: "GET",
		path: `${prefix}/messages/:id/raw`,
		handler: handleDownloadRawMessage,
	},
	{ method: "GET", path: `${prefix}/messages/:id`, handler: handleGetMessage },

	{ method: "GET", path: `${prefix}/threads`, handler: handleListThreads },
	{
		method: "GET",
		path: `${prefix}/threads/:id/messages`,
		handler: handleListThreadMessages,
	},
	{
		method: "POST",
		path: `${prefix}/threads/:id/:action`,
		handler: handleThreadAction,
	},
	{ method: "PATCH", path: `${prefix}/threads/:id`, handler: handlePatchThread },
	{ method: "GET", path: `${prefix}/threads/:id`, handler: handleGetThread },

	{ method: "POST", path: `${prefix}/search`, handler: handleSearch },

	{
		method: "GET",
		path: `${prefix}/attachments/:id`,
		handler: handleDownloadAttachment,
	},
];
