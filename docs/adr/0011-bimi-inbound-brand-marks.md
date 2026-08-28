# BIMI inbound brand marks

Inbound BIMI logos are shown only after core verifies DKIM/SPF/DMARC itself (Cloudflare Email Routing does not reliably stamp Authentication-Results), the message DMARC-passes with alignment, and the organizational domain publishes an enforcing policy (`quarantine`/`reject`). We accept self-asserted BIMI (no VMC), rasterize the SVG to WebP in R2, cache per publishing domain with TTL (including negative cache), resolve BIMI asynchronously after store, and serve logos only to authenticated sessions—not as public unauthenticated URLs.
