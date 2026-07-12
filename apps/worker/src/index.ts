import PostalMime from 'postal-mime';

import { withDb } from './db/client';
import { tryConsumeValidationInbound } from './lib/domain-validation/consume-inbound';
import { processTimedOutValidationRuns } from './lib/domain-validation/run-engine';
import { resolveMailboxForEnvelope } from './lib/resolve-mailbox';
import { isSelfSentLoopback } from './lib/messages/self-loopback';
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
				const raw = await new Response(message.raw).arrayBuffer();
				const parsed = await PostalMime.parse(raw);

				if (await tryConsumeValidationInbound(db, message, parsed)) {
					console.log(
						`Consumed validation email: ${message.from} -> ${message.to}`,
					);
					return;
				}

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

				const threading = extractThreadingHeaders(message.headers, parsed);

				if (!threading.messageId) {
					message.setReject('Message-ID header is required');
					return;
				}

				// Our own outbound mail (e.g. CC'ing an internal mailbox) loops back
				// through Email Routing. The outbound send already makes it visible to
				// internal recipients, so drop the duplicate copy instead of storing a
				// conflicting inbound row.
				if (await isSelfSentLoopback(db, parsed, message)) {
					console.log(
						`Skipped self-sent loopback ${threading.messageId}: ${message.from} -> ${resolution.envelopeTo}`,
					);
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

	async fetch(request, env, _ctx): Promise<Response> {
		return handleFetchRequest(request, env);
	},

	async scheduled(_controller, env, _ctx): Promise<void> {
		try {
			const processed = await withDb(env, (db) =>
				processTimedOutValidationRuns(db),
			);
			if (processed > 0) {
				console.log(`Processed ${processed} timed-out validation run(s)`);
			}
		} catch (error) {
			console.error('Scheduled validation processor error:', error);
		}
	},
} satisfies ExportedHandler<Env>;
