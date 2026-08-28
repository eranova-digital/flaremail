import { eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { bimiLogos } from "../db/schema";
import { getBimiLogoObject } from "../lib/bimi/storage";
import { parseBimiLogoSize } from "../lib/bimi/keys";

export async function downloadBimiLogo(
	db: Database,
	bucket: R2Bucket,
	domainParam: string,
	sizeParam: string | null,
): Promise<Response> {
	const size = parseBimiLogoSize(sizeParam);
	if (!size) {
		throw new Error("size must be small or large");
	}

	const domain = decodeURIComponent(domainParam).toLowerCase().trim();
	if (!domain || domain.includes("/") || domain.includes("..")) {
		throw new Error("BIMI logo not found");
	}

	const [row] = await db
		.select()
		.from(bimiLogos)
		.where(eq(bimiLogos.domain, domain))
		.limit(1);

	if (!row || row.status !== "found" || !row.logoUpdatedAt) {
		throw new Error("BIMI logo not found");
	}

	const object = await getBimiLogoObject(bucket, domain, size);
	if (!object) {
		throw new Error("BIMI logo not found");
	}

	const headers = new Headers();
	headers.set("Content-Type", "image/webp");
	headers.set("Cache-Control", "private, max-age=86400");
	headers.set(
		"ETag",
		`"${row.logoUpdatedAt.toISOString()}-${size}"`,
	);

	return new Response(object.body, { headers });
}
