export function rawEmlKeyForMessageId(id: string): string {
	return `raw/${id}.eml`;
}

export async function storeRawEml(
	bucket: R2Bucket,
	id: string,
	raw: ArrayBuffer | Uint8Array,
): Promise<string> {
	const key = rawEmlKeyForMessageId(id);

	await bucket.put(key, raw, {
		httpMetadata: {
			contentType: "message/rfc822",
		},
	});

	return key;
}
