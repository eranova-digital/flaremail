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
	{ method: "GET", path: `${prefix}/domains`, action: "authenticated", handler: handleListDomains },
	{ method: "POST", path: `${prefix}/domains`, action: "platform", handler: handleCreateDomain },
	{ method: "GET", path: `${prefix}/domains/:id`, action: "domain_admin", handler: handleGetDomain },
	{ method: "PATCH", path: `${prefix}/domains/:id`, action: "domain_admin", handler: handleUpdateDomain },
	{ method: "DELETE", path: `${prefix}/domains/:id`, action: "domain_admin", handler: handleDeleteDomain },
	{
		method: "GET",
		path: `${prefix}/domains/:id/validation-runs`,
		action: "domain_admin",
		handler: handleListValidationRuns,
	},
	{
		method: "POST",
		path: `${prefix}/domains/:id/validation-runs`,
		action: "domain_admin",
		handler: handleCreateValidationRun,
	},
	{
		method: "GET",
		path: `${prefix}/domains/:id/validation-runs/:runId`,
		action: "domain_admin",
		handler: handleGetValidationRun,
	},

	{ method: "GET", path: `${prefix}/mailboxes`, action: "authenticated", handler: handleListMailboxes },
	{ method: "POST", path: `${prefix}/mailboxes`, action: "domain_admin", handler: handleCreateMailbox },
	{ method: "GET", path: `${prefix}/mailboxes/:id`, action: "mail_read", handler: handleGetMailbox },
	{
		method: "PATCH",
		path: `${prefix}/mailboxes/:id`,
		action: "domain_admin",
		handler: handleUpdateMailbox,
	},
	{
		method: "DELETE",
		path: `${prefix}/mailboxes/:id`,
		action: "domain_admin",
		handler: handleDeleteMailbox,
	},

	{
		method: "GET",
		path: `${prefix}/mailboxes/:mailboxId/labels`,
		action: "mail_read",
		handler: handleListLabels,
	},
	{
		method: "POST",
		path: `${prefix}/mailboxes/:mailboxId/labels`,
		action: "domain_admin",
		handler: handleCreateLabel,
	},
	{
		method: "GET",
		path: `${prefix}/mailboxes/:mailboxId/labels/:id`,
		action: "mail_read",
		handler: handleGetLabel,
	},
	{
		method: "PATCH",
		path: `${prefix}/mailboxes/:mailboxId/labels/:id`,
		action: "domain_admin",
		handler: handleUpdateLabel,
	},
	{
		method: "DELETE",
		path: `${prefix}/mailboxes/:mailboxId/labels/:id`,
		action: "domain_admin",
		handler: handleDeleteLabel,
	},

	{ method: "POST", path: `${prefix}/messages/send`, action: "mail_write", handler: handleSendMessage },
	{ method: "POST", path: `${prefix}/messages/drafts`, action: "mail_write", handler: handleCreateDraft },
	{
		method: "PATCH",
		path: `${prefix}/messages/drafts/:id`,
		action: "mail_write",
		handler: handleUpdateDraft,
	},
	{
		method: "DELETE",
		path: `${prefix}/messages/drafts/:id`,
		action: "mail_write",
		handler: handleDeleteDraft,
	},
	{
		method: "POST",
		path: `${prefix}/messages/drafts/:id/send`,
		action: "mail_write",
		handler: handleSendDraft,
	},
	{
		method: "POST",
		path: `${prefix}/messages/:id/reply`,
		action: "mail_write",
		handler: handleReplyToMessage,
	},
	{
		method: "POST",
		path: `${prefix}/messages/:id/forward`,
		action: "mail_write",
		handler: handleForwardToMessage,
	},
	{
		method: "GET",
		path: `${prefix}/messages/:id/preview`,
		action: "mail_read",
		handler: handleGetMessagePreview,
	},
	{
		method: "GET",
		path: `${prefix}/messages/:id/raw`,
		action: "mail_read",
		handler: handleDownloadRawMessage,
	},
	{ method: "GET", path: `${prefix}/messages/:id`, action: "mail_read", handler: handleGetMessage },

	{ method: "GET", path: `${prefix}/threads`, action: "mail_read", handler: handleListThreads },
	{
		method: "GET",
		path: `${prefix}/threads/:id/messages`,
		action: "mail_read",
		handler: handleListThreadMessages,
	},
	{
		method: "POST",
		path: `${prefix}/threads/:id/:action`,
		action: "mail_write",
		handler: handleThreadAction,
	},
	{ method: "PATCH", path: `${prefix}/threads/:id`, action: "mail_write", handler: handlePatchThread },
	{ method: "GET", path: `${prefix}/threads/:id`, action: "mail_read", handler: handleGetThread },

	{ method: "POST", path: `${prefix}/search`, action: "mail_read", handler: handleSearch },

	{
		method: "GET",
		path: `${prefix}/attachments/:id`,
		action: "mail_read",
		handler: handleDownloadAttachment,
	},
];
