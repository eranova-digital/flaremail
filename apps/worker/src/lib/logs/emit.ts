import type { Database } from "../../db/client";
import { logs } from "../../db/schema";
import { getInstanceSettings } from "../../services/instance-settings";
import type { EmitLogInput } from "./types";

export async function emitLog(
	db: Database,
	input: EmitLogInput,
): Promise<string | null> {
	if (
		!Number.isInteger(input.importance) ||
		input.importance < 0 ||
		input.importance > 10
	) {
		throw new Error("importance must be an integer from 0 to 10");
	}

	const settings = await getInstanceSettings(db);
	if (!settings.logsEnabled) {
		return null;
	}
	if (input.importance > settings.maxImportanceStored) {
		return null;
	}

	const id = crypto.randomUUID();
	await db.insert(logs).values({
		id,
		importance: input.importance,
		type: input.type,
		summary: input.summary,
		refs: JSON.stringify(input.refs ?? {}),
		actorAccountId: input.actorAccountId ?? null,
		context: input.context ? JSON.stringify(input.context) : null,
	});

	return id;
}

/** Await emitLog without failing the main action if logging fails. */
export async function safeEmitLog(
	db: Database,
	input: EmitLogInput,
): Promise<void> {
	try {
		await emitLog(db, input);
	} catch (error) {
		console.error("Failed to emit log", error);
	}
}
