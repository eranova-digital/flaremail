import { withDb } from "../db/client";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { validationError } from "../lib/http/problem";
import type { RouteContext } from "../lib/http/router";
import {
	deleteSystemEmailTemplate,
	getSystemEmailTemplateContent,
	listSystemEmailTemplates,
	uploadSystemEmailTemplate,
} from "../services/system-email-templates";

async function readSystemTemplateUpload(context: RouteContext) {
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

	const file = formData.get("file");
	if (!(file instanceof File) || file.size === 0) {
		return validationError(context.request, "file is required");
	}

	return file;
}

export async function handleListSystemEmailTemplates(context: RouteContext) {
	try {
		const items = await withDb(context.env, (db) =>
			listSystemEmailTemplates(db, context.principal),
		);
		return jsonResponse({ items });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleUploadSystemEmailTemplate(context: RouteContext) {
	const file = await readSystemTemplateUpload(context);
	if (file instanceof Response) {
		return file;
	}

	try {
		const template = await withDb(context.env, (db) =>
			uploadSystemEmailTemplate(
				db,
				context.env.BUCKET,
				context.principal,
				context.params.key,
				file,
			),
		);
		return jsonResponse(template);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleGetSystemEmailTemplateContent(
	context: RouteContext,
) {
	try {
		const html = await withDb(context.env, (db) =>
			getSystemEmailTemplateContent(
				db,
				context.env.BUCKET,
				context.principal,
				context.params.key,
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

export async function handleDeleteSystemEmailTemplate(context: RouteContext) {
	try {
		await withDb(context.env, (db) =>
			deleteSystemEmailTemplate(
				db,
				context.env.BUCKET,
				context.principal,
				context.params.key,
			),
		);
		return new Response(null, { status: 204 });
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}
