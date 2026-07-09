import { useSyncExternalStore } from "react";

import type { ThreadMessagePreview } from "@/lib/api/generated";

/**
 * Tracks messages that are currently being sent, keyed by thread. This lives
 * outside of React Query so that background refetches / polling can't clobber
 * the "sending" state while the network request is still in flight. ThreadView
 * overlays this on top of the fetched messages and renders a skeleton for any
 * message that is still pending.
 */

const pendingByThread = new Map<string, Map<string, ThreadMessagePreview>>();
const snapshotByThread = new Map<string, ThreadMessagePreview[]>();
const listeners = new Set<() => void>();

const EMPTY: ThreadMessagePreview[] = [];

function emit() {
	for (const listener of listeners) {
		listener();
	}
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function rebuildSnapshot(threadId: string) {
	const pending = pendingByThread.get(threadId);
	if (!pending || pending.size === 0) {
		snapshotByThread.delete(threadId);
		return;
	}
	snapshotByThread.set(threadId, Array.from(pending.values()));
}

export function buildPendingMessage({
	draftId,
	selfAddress,
	to,
	inReplyToMessageId,
	hasAttachments,
}: {
	draftId: string;
	selfAddress?: string | null;
	to?: string;
	inReplyToMessageId?: string | null;
	hasAttachments?: boolean;
}): ThreadMessagePreview {
	const now = new Date().toISOString();

	return {
		id: draftId,
		from: selfAddress ?? undefined,
		to,
		direction: "outbound",
		sendStatus: "sending",
		sentAt: now,
		receivedAt: now,
		inReplyTo: inReplyToMessageId ?? null,
		hasAttachments: hasAttachments ?? false,
	};
}

export function addPendingSend(
	threadId: string,
	message: ThreadMessagePreview,
) {
	if (!message.id) {
		return;
	}

	let pending = pendingByThread.get(threadId);
	if (!pending) {
		pending = new Map();
		pendingByThread.set(threadId, pending);
	}
	pending.set(message.id, { ...message, sendStatus: "sending" });
	rebuildSnapshot(threadId);
	emit();
}

export function removePendingSend(threadId: string, draftId: string) {
	const pending = pendingByThread.get(threadId);
	if (!pending) {
		return;
	}

	pending.delete(draftId);
	if (pending.size === 0) {
		pendingByThread.delete(threadId);
	}
	rebuildSnapshot(threadId);
	emit();
}

function getSnapshot(threadId: string | undefined): ThreadMessagePreview[] {
	if (!threadId) {
		return EMPTY;
	}
	return snapshotByThread.get(threadId) ?? EMPTY;
}

export function usePendingSends(
	threadId: string | undefined,
): ThreadMessagePreview[] {
	return useSyncExternalStore(
		subscribe,
		() => getSnapshot(threadId),
		() => EMPTY,
	);
}

export function isPendingSendId(
	threadId: string | undefined,
	messageId?: string | null,
): boolean {
	if (!threadId || !messageId) {
		return false;
	}
	return pendingByThread.get(threadId)?.has(messageId) ?? false;
}
