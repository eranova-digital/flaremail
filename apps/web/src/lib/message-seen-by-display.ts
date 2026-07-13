import type { SeenByViewer, ThreadMessagePreview } from "@/lib/api/client";

type MessageSeenBySource = Pick<
	ThreadMessagePreview,
	"id" | "sendStatus" | "seenBy"
>;

/**
 * Shows each viewer only on the latest message they have read. Earlier messages
 * may still list them in the database, but displaying them there is redundant.
 */
export function computeMessageDisplaySeenBy(
	messages: MessageSeenBySource[],
): Map<string, SeenByViewer[]> {
	const ordered = messages.filter(
		(message) => message.id && message.sendStatus !== "draft",
	);
	const map = new Map<string, SeenByViewer[]>();

	for (let index = 0; index < ordered.length; index++) {
		const message = ordered[index]!;
		const laterViewerIds = new Set<string>();

		for (let laterIndex = index + 1; laterIndex < ordered.length; laterIndex++) {
			for (const viewer of ordered[laterIndex]!.seenBy ?? []) {
				if (viewer.accountId) {
					laterViewerIds.add(viewer.accountId);
				}
			}
		}

		map.set(
			message.id!,
			(message.seenBy ?? []).filter(
				(viewer) => viewer.accountId && !laterViewerIds.has(viewer.accountId),
			),
		);
	}

	return map;
}
