export function messageExternalImageProxyPath(
	messageId: string,
	imageId: string,
): string {
	return `/api/v1/messages/${messageId}/images/${imageId}`;
}
