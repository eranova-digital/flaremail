import {
	isMessageOnly,
	resolveSearchDateBound,
	type SearchExpr,
} from "@flaremail/mail-search-query";
import {
	and,
	eq,
	exists,
	gte,
	lte,
	not,
	or,
	sql,
	type SQL,
} from "drizzle-orm";

import type { Database } from "../../db/client";
import {
	attachments,
	labels,
	messageMailboxes,
	messages,
	threadLabels,
	threadMailboxes,
} from "../../db/schema";
import type { ThreadFolder } from "../../lib/mailbox-types";
import { ilikeContains, ilikeSuffix } from "./search-ilike";

export const DOCUMENT_MIME_TYPES = [
	"application/pdf",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"application/vnd.ms-excel",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/vnd.ms-powerpoint",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	"application/rtf",
	"text/rtf",
	"application/vnd.oasis.opendocument.text",
	"application/vnd.oasis.opendocument.spreadsheet",
	"application/vnd.oasis.opendocument.presentation",
] as const;

type CompileContext = {
	db: Database;
	mailboxId: string;
	now: Date;
};

export function compileThreadMatch(
	ctx: CompileContext,
	expr: SearchExpr,
): SQL {
	if (isMessageOnly(expr)) {
		return existsMatchingMessage(ctx, compileMessagePred(ctx, expr));
	}

	switch (expr.type) {
		case "and":
			return requireSql(
				and(compileThreadMatch(ctx, expr.left), compileThreadMatch(ctx, expr.right)),
			);
		case "or":
			return requireSql(
				or(compileThreadMatch(ctx, expr.left), compileThreadMatch(ctx, expr.right)),
			);
		case "not":
			return not(compileThreadMatch(ctx, expr.expr));
		case "text":
		case "op":
			return compileThreadLeaf(ctx, expr);
	}
}

export function compileMessagePred(ctx: CompileContext, expr: SearchExpr): SQL {
	switch (expr.type) {
		case "and":
			return requireSql(
				and(compileMessagePred(ctx, expr.left), compileMessagePred(ctx, expr.right)),
			);
		case "or":
			return requireSql(
				or(compileMessagePred(ctx, expr.left), compileMessagePred(ctx, expr.right)),
			);
		case "not":
			return not(compileMessagePred(ctx, expr.expr));
		case "text":
			return compileTextPred(expr.value);
		case "op":
			return compileMessageOp(ctx, expr.name, expr.value);
	}
}

function compileThreadLeaf(ctx: CompileContext, expr: SearchExpr): SQL {
	if (expr.type !== "op") {
		if (expr.type === "text") {
			return existsMatchingMessage(ctx, compileTextPred(expr.value));
		}
		return sql`false`;
	}
	if (expr.name === "in") {
		if (expr.value === "any") {
			return sql`true`;
		}
		return eq(threadMailboxes.folder, expr.value as ThreadFolder);
	}
	if (expr.name === "is") {
		if (expr.value === "read") {
			return eq(threadMailboxes.isRead, true);
		}
		if (expr.value === "unread") {
			return eq(threadMailboxes.isRead, false);
		}
		return eq(threadMailboxes.isStarred, true);
	}
	if (expr.name === "label") {
		return exists(
			ctx.db
				.select({ one: sql`1` })
				.from(threadLabels)
				.innerJoin(labels, eq(labels.id, threadLabels.labelId))
				.where(
					and(
						eq(threadLabels.threadId, threadMailboxes.threadId),
						eq(labels.mailboxId, ctx.mailboxId),
						sql`lower(${labels.name}) = ${expr.value.toLowerCase()}`,
					),
				),
		);
	}
	return existsMatchingMessage(ctx, compileMessageOp(ctx, expr.name, expr.value));
}

function compileTextPred(value: string): SQL {
	return requireSql(
		or(
			ilikeContains(sql`${messages.subject}`, value),
			ilikeContains(sql`${messages.textBody}`, value),
			ilikeContains(sql`${messages.from}`, value),
			ilikeContains(sql`${messages.to}`, value),
			ilikeContains(sql`${messages.cc}`, value),
			ilikeContains(sql`${messages.bcc}`, value),
		),
	);
}

function compileMessageOp(ctx: CompileContext, name: string, value: string): SQL {
	if (name === "from") {
		return ilikeContains(sql`${messages.from}`, value);
	}
	if (name === "to") {
		return ilikeContains(sql`${messages.to}`, value);
	}
	if (name === "cc") {
		return ilikeContains(sql`${messages.cc}`, value);
	}
	if (name === "bcc") {
		return ilikeContains(sql`${messages.bcc}`, value);
	}
	if (name === "subject") {
		return ilikeContains(sql`${messages.subject}`, value);
	}
	if (name === "since") {
		return gte(messages.receivedAt, resolveSearchDateBound(value, ctx.now, "since"));
	}
	if (name === "until") {
		return lte(messages.receivedAt, resolveSearchDateBound(value, ctx.now, "until"));
	}
	if (name === "has") {
		return compileHasPred(ctx, value);
	}
	return sql`false`;
}

function compileHasPred(ctx: CompileContext, value: string): SQL {
	const attachmentOnly = sql`lower(coalesce(${attachments.disposition}, 'attachment')) = 'attachment'`;
	let extra: SQL = sql`true`;
	if (value === "attachment") {
		extra = sql`true`;
	} else if (value === "image") {
		extra = sql`lower(${attachments.mimeType}) like 'image/%'`;
	} else if (value === "document") {
		extra = sql`lower(${attachments.mimeType}) in (${sql.join(
			DOCUMENT_MIME_TYPES.map((mime) => sql`${mime}`),
			sql`, `,
		)})`;
	} else {
		extra = ilikeSuffix(sql`coalesce(${attachments.filename}, '')`, value);
	}

	return exists(
		ctx.db
			.select({ one: sql`1` })
			.from(attachments)
			.where(
				and(eq(attachments.messageId, messages.id), attachmentOnly, extra),
			),
	);
}

function existsMatchingMessage(ctx: CompileContext, inner: SQL): SQL {
	return exists(
		ctx.db
			.select({ one: sql`1` })
			.from(messages)
			.innerJoin(
				messageMailboxes,
				eq(messageMailboxes.messageId, messages.id),
			)
			.where(
				and(
					eq(messageMailboxes.mailboxId, ctx.mailboxId),
					eq(messages.threadId, threadMailboxes.threadId),
					inner,
				),
			),
	);
}

function requireSql(value: SQL | undefined): SQL {
	return value ?? sql`true`;
}
