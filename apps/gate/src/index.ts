/**
 * Thin public edge: forward /api/* to core via service binding.
 * Static assets and SPA fallback are handled by Wrangler assets config.
 */
export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		if (!url.pathname.startsWith("/api/")) {
			return new Response("Not Found", { status: 404 });
		}
		return env.CORE.fetch(request);
	},
} satisfies ExportedHandler<Env>;
