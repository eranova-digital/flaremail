/**
 * Thin public edge: forward /api/* and /health to core via service binding.
 * Static assets and SPA fallback are handled by Wrangler assets config.
 */
export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === "/health" || url.pathname.startsWith("/api/")) {
			return env.CORE.fetch(request);
		}
		return new Response("Not Found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;
