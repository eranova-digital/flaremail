import PostalMime from "postal-mime";

import { withDb } from "./db/client";
import { resolveMailboxForEnvelope } from "./lib/resolve-mailbox";
import { storeInboundEmail } from "./lib/messages/store-inbound-email";
import { extractThreadingHeaders } from "./lib/threading-headers";
import { handleFetchRequest } from "./routes";

export default {
	async email(message, env, ctx): Promise<void> {
		const raw = await new Response(message.raw).arrayBuffer();
		const parsed = await PostalMime.parse(raw);
		const threading = extractThreadingHeaders(message.headers, parsed);

		if (!threading.messageId) {
			message.setReject("Message-ID header is required");
			return;
		}

		await withDb(env, async (db) => {
			const mailbox = await resolveMailboxForEnvelope(db, message.to);
			if (!mailbox) {
				message.setReject("Unknown recipient");
				return;
			}

			const id = await storeInboundEmail(
				db,
				env.BUCKET,
				message,
				parsed,
				mailbox,
			);
			console.log(
				`Stored message ${id}: ${message.from} -> ${mailbox.envelopeTo} (${parsed.subject ?? "no subject"}, ${parsed.attachments.length} attachment(s))`,
			);
		});
	},

	async fetch(request, env): Promise<Response> {
		return handleFetchRequest(request, env);
	},
} satisfies ExportedHandler<Env>;
