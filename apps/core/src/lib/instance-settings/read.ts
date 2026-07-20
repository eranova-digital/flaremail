import { eq } from "drizzle-orm";

import type { Database } from "../../db/client";
import { instanceSettings } from "../../db/schema";

const INSTANCE_SETTINGS_ID = "default";

export type LogEmitSettings = {
	logsEnabled: boolean;
	maxImportanceStored: number;
};

const DEFAULT_LOG_EMIT_SETTINGS: LogEmitSettings = {
	logsEnabled: true,
	maxImportanceStored: 10,
};

export async function getLogEmitSettings(db: Database): Promise<LogEmitSettings> {
	const [row] = await db
		.select({
			logsEnabled: instanceSettings.logsEnabled,
			maxImportanceStored: instanceSettings.maxImportanceStored,
		})
		.from(instanceSettings)
		.where(eq(instanceSettings.id, INSTANCE_SETTINGS_ID))
		.limit(1);

	return row ?? DEFAULT_LOG_EMIT_SETTINGS;
}

export async function getPersistNoreplyOutboundEmails(
	db: Database,
): Promise<boolean> {
	const [row] = await db
		.select({
			persistNoreplyOutboundEmails: instanceSettings.persistNoreplyOutboundEmails,
		})
		.from(instanceSettings)
		.where(eq(instanceSettings.id, INSTANCE_SETTINGS_ID))
		.limit(1);

	return row?.persistNoreplyOutboundEmails ?? false;
}
