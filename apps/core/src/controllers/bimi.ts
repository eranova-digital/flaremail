import { withDb } from "../db/client";
import { handleRouteError } from "../lib/http/handle-route-error";
import type { RouteContext } from "../lib/http/router";
import { downloadBimiLogo } from "../services/bimi";

export async function handleGetBimiLogo(context: RouteContext) {
	const url = new URL(context.request.url);
	const size = url.searchParams.get("size") ?? "small";

	try {
		return await withDb(context.env, (db) =>
			downloadBimiLogo(
				db,
				context.env.BUCKET,
				context.params.domain,
				size,
			),
		);
	} catch (error) {
		return handleRouteError(error, context.request);
	}
}
