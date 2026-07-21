import { withDb } from "../db/client";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { parseJsonBody } from "../lib/http/parse-body";
import { validationError } from "../lib/http/problem";
import type { RouteContext } from "../lib/http/router";
import {
	createTemplate,
	deleteTemplate,
	getTemplate,
	getTemplateContent,
	listManageableTemplates,
	listTemplatesForMailbox,
	principalCanManageGlobalTemplates,
	updateTemplate,
} from "../services/email-templates";

async function readTemplateUpload(context: RouteContext) {
	const contentType = context.request.headers.get("Content-Type") ?? "";
	if (!contentType.toLowerCase().includes("multipart/form-data")) {
		return validationError(context.request, "Expected multipart form data");
	}

	let formData: FormData;
	try {
		formData = await context.request.formData();
	} catch {
		return validationError(context.request, "Invalid form data");
	}

	const nameValue = formData.get("name");
	const name = typeof nameValue === "string" ? nameValue : "";
	if (!name.trim()) {
		return validationError(context.request, "name is required");
	}

	const mailboxRaw = formData.get("mailboxId");
	let mailboxId: string | null = null;
	if (typeof mailboxRaw === "string" && mailboxRaw.trim()) {
		mailboxId = mailboxRaw.trim();
	}

	const file = formData.get("file");
	if (!(file instanceof File) || file.size === 0) {
		return validationError(context.request, "file is required");
	}

	return { name, mailboxId, file };
}

export async function handleListEmailTemplates(context: RouteContext) {
	const url = new URL(context.request.url);
	const manage = url.searchParams.get("manage") === "1";
	const mailboxId = url.searchParams.get("mailboxId")?.trim() || undefined;

	try {
		if (manage) {
			const items = await withDb(context.env, (db) =>
				listManageableTemplates(db, context.principal),
			);
			return jsonResponse({
				items,
				capabilities: {
					canCreateGlobal: principalCanManageGlobalTemplates(context.principal),
				},
			});
		}

		if (!mailboxId) {
			return validationError(
				context.request,
				"mailboxId is required unless manage=1",
			);
		}

		const items = await withDb(context.env, (db) =>
			listTemplatesForMailbox(db, context.principal, mailboxId),
		);
		return jsonResponse({ items });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleCreateEmailTemplate(context: RouteContext) {
	const upload = await readTemplateUpload(context);
	if (upload instanceof Response) {
		return upload;
	}

	try {
		const template = await withDb(context.env, (db) =>
			createTemplate(db, context.env.BUCKET, context.principal, upload),
		);
		return jsonResponse(template, 201);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleGetEmailTemplate(context: RouteContext) {
	const url = new URL(context.request.url);
	const mailboxId = url.searchParams.get("mailboxId")?.trim() || undefined;

	try {
		const template = await withDb(context.env, (db) =>
			getTemplate(db, context.principal, context.params.id, mailboxId),
		);
		return jsonResponse(template);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleGetEmailTemplateContent(context: RouteContext) {
	const url = new URL(context.request.url);
	const mailboxId = url.searchParams.get("mailboxId")?.trim() || undefined;

	try {
		const html = await withDb(context.env, (db) =>
			getTemplateContent(
				db,
				context.env.BUCKET,
				context.principal,
				context.params.id,
				mailboxId,
			),
		);
		return new Response(html, {
			status: 200,
			headers: {
				"Content-Type": "text/html; charset=utf-8",
				"Cache-Control": "private, no-store",
			},
		});
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleUpdateEmailTemplate(context: RouteContext) {
	const body = await parseJsonBody(context.request);
	if (body instanceof Response) {
		return body;
	}

	const value = body as Record<string, unknown>;
	if (typeof value.name !== "string" || !value.name.trim()) {
		return validationError(context.request, "Field 'name' is required");
	}

	try {
		const template = await withDb(context.env, (db) =>
			updateTemplate(db, context.principal, context.params.id, {
				name: value.name as string,
			}),
		);
		return jsonResponse(template);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleDeleteEmailTemplate(context: RouteContext) {
	try {
		await withDb(context.env, (db) =>
			deleteTemplate(
				db,
				context.env.BUCKET,
				context.principal,
				context.params.id,
			),
		);
		return new Response(null, { status: 204 });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}
