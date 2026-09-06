/** Specs that must run inside workerd (`cloudflare:test`, Cache API, or HTMLRewriter). */
export const WORKER_SPECS = [
	"test/index.spec.ts",
	"test/outbound-api.spec.ts",
	"test/drafts-list-api.spec.ts",
	"test/threads-api.spec.ts",
	"test/search-api.spec.ts",
	"test/mfa-service.spec.ts",
	"test/email-images.spec.ts",
	"test/prepare-email-html.spec.ts",
];
