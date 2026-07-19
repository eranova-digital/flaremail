/**
 * One-time challenge JWT consumption via the Workers Cache API.
 * Best-effort across Colos; combined with short JWT TTL this blocks replay
 * within the same location after a successful verify.
 */

const CHALLENGE_CACHE_HOST = "https://flaremail-challenge-jti.internal";

function challengeCacheKey(jti: string): Request {
	return new Request(`${CHALLENGE_CACHE_HOST}/${encodeURIComponent(jti)}`);
}

export async function assertChallengeJtiFresh(
	jti: string,
	ttlSeconds: number,
): Promise<void> {
	const cache = caches.default;
	const key = challengeCacheKey(jti);
	const existing = await cache.match(key);
	if (existing) {
		throw new Error("Challenge already used");
	}
	await cache.put(
		key,
		new Response("1", {
			headers: {
				"Cache-Control": `public, max-age=${Math.max(1, ttlSeconds)}`,
			},
		}),
	);
}
