export function decodeBase64(content: string): ArrayBuffer {
	const normalized = content.replace(/\s+/g, "");
	const binary = atob(normalized);
	const bytes = new Uint8Array(binary.length);

	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}

	return bytes.buffer;
}
