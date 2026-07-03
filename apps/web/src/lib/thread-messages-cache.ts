import type { SendCommandResponse } from "@/lib/api/generated";

export const THREAD_MESSAGES_POLL_MS = 15_000;
export const THREADS_POLL_MS = 30_000;

export type SendResult = SendCommandResponse;
