import PostalMime from 'postal-mime';

import { withDb } from './db/client';
import { resolveMailboxForEnvelope } from './lib/resolve-mailbox';
import { storeInboundEmail } from './lib/messages/store-inbound-email';
import {
	extractThreadingHeaders,
	getMessageIdFromHeaders,
} from './lib/threading-headers';
import { handleFetchRequest } from './routes';

export default {
	async email(message, env, ctx): Promise<void> {
		try {
			await withDb(env, async (db) => {
				const resolution = await resolveMailboxForEnvelope(db, message.to);
				if (!resolution) {
					message.setReject('Unknown recipient');
					return;
				}

				if (resolution.action === 'forward') {
					try {
						const result = await message.forward(resolution.forwardTo);
						const messageId = getMessageIdFromHeaders(message.headers);
						const cfMessageId = result?.messageId;
						console.log(
							`Forwarded message ${messageId ?? '(no Message-ID)'}: ${message.from} -> ${resolution.envelopeTo} => ${resolution.forwardTo}${cfMessageId ? ` (cf-id: ${cfMessageId})` : ''}`,
						);
					} catch (error) {
						console.error(
							`Failed to forward ${resolution.envelopeTo} => ${resolution.forwardTo}:`,
							error,
						);
						message.setReject('Forwarding failed');
					}
					return;
				}

				const raw = await new Response(message.raw).arrayBuffer();
				const parsed = await PostalMime.parse(raw);
				const threading = extractThreadingHeaders(message.headers, parsed);

				if (!threading.messageId) {
					message.setReject('Message-ID header is required');
					return;
				}

				const id = await storeInboundEmail(
					db,
					env.BUCKET,
					message,
					parsed,
					resolution,
				);
				console.log(
					`Stored message ${id}: ${message.from} -> ${resolution.envelopeTo} (${parsed.subject ?? 'no subject'}, ${parsed.attachments.length} attachment(s))`,
				);
			});
		} catch (error) {
			console.error('Inbound email handler error:', error);
			message.setReject('Temporary processing error');
		}
	},

	async fetch(request, env): Promise<Response> {
		return handleFetchRequest(request, env);
	},
} satisfies ExportedHandler<Env>;
