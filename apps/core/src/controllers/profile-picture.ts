import { withDb } from "../db/client";
import { handleRouteError } from "../lib/http/handle-route-error";
import { jsonResponse } from "../lib/http/json";
import { validationError } from "../lib/http/problem";
import type { RouteContext } from "../lib/http/router";
import {
	downloadProfilePicture,
	removeProfilePicture,
	removeProfilePictureForAccount,
	uploadProfilePicture,
	uploadProfilePictureForAccount,
} from "../services/accounts/profile-picture";

async function readProfilePictureUpload(context: RouteContext) {
	if (!context.principal.accountId) {
		return validationError(context.request, "Authentication required");
	}

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

export async function handleUploadProfilePicture(context: RouteContext) {
	const file = await readProfilePictureUpload(context);
	if (file instanceof Response) {
		return file;
	}

	try {
		const result = await withDb(context.env, (db) =>
			uploadProfilePicture(
				db,
				context.env.BUCKET,
				context.principal,
				file,
			),
		);
		return jsonResponse(result);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleUploadAccountProfilePicture(context: RouteContext) {
	const file = await readProfilePictureUpload(context);
	if (file instanceof Response) {
		return file;
	}

	try {
		const result = await withDb(context.env, (db) =>
			uploadProfilePictureForAccount(
				db,
				context.env.BUCKET,
				context.principal,
				context.params.id,
				file,
			),
		);
		return jsonResponse(result);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleDeleteProfilePicture(context: RouteContext) {
	try {
		const result = await withDb(context.env, (db) =>
			removeProfilePicture(db, context.env.BUCKET, context.principal),
		);
		return jsonResponse(result);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleDeleteAccountProfilePicture(context: RouteContext) {
	try {
		const result = await withDb(context.env, (db) =>
			removeProfilePictureForAccount(
				db,
				context.env.BUCKET,
				context.principal,
				context.params.id,
			),
		);
		return jsonResponse(result);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}

export async function handleGetProfilePicture(context: RouteContext) {
	const url = new URL(context.request.url);
	const size = url.searchParams.get("size");

	try {
		return await withDb(context.env, (db) =>
			downloadProfilePicture(
				db,
				context.env.BUCKET,
				context.params.id,
				size,
			),
		);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}
