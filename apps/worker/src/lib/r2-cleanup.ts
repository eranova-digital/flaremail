export async function deleteR2Objects(
	bucket: R2Bucket,
	keys: string[],
): Promise<void> {
	if (keys.length === 0) {
		return;
	}

	await Promise.all(
		keys.map(async (key) => {
			try {
				await bucket.delete(key);
			} catch (error) {
				console.error(`Failed to delete R2 object ${key}:`, error);
			}
		}),
	);
}
