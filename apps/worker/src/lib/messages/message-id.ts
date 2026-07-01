export { normalizeMessageId } from "../threading-headers";
import { normalizeMessageId } from "../threading-headers";

export function generateMessageId(domain: string): string {
	const normalizedDomain = domain.trim().toLowerCase();
	return `<${crypto.randomUUID()}@${normalizedDomain}>`;
}

export function canonicalizeSentMessageId(raw: string): string {
	const normalized = normalizeMessageId(raw);
	if (!normalized) {
		throw new Error("Cloudflare returned an empty message id");
	}

	return normalized;
}
