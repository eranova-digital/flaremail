import { downloadRawMessage } from "@/lib/api/client";

export async function fetchRawMessageBlob(
	messageId: string,
	mailboxId: string,
): Promise<Blob> {
	const { data } = await downloadRawMessage({
		throwOnError: true,
		path: { id: messageId },
		query: { mailboxId },
		parseAs: "blob",
	});

	if (!(data instanceof Blob)) {
		throw new Error("Unexpected raw message response");
	}

	return data;
}

export async function fetchRawMessageText(
	messageId: string,
	mailboxId: string,
): Promise<string> {
	const blob = await fetchRawMessageBlob(messageId, mailboxId);
	return blob.text();
}

export async function saveRawMessageFile(
	messageId: string,
	mailboxId: string,
): Promise<void> {
	const blob = await fetchRawMessageBlob(messageId, mailboxId);
	const url = URL.createObjectURL(blob);

	try {
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = `${messageId}.eml`;
		anchor.rel = "noopener";
		anchor.click();
	} finally {
		URL.revokeObjectURL(url);
	}
}
