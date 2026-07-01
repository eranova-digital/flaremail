import { and, eq } from "drizzle-orm";

import type { Database } from "../db/client";
import { labels } from "../db/schema";
import { toLabelDto } from "./dto";

export async function listLabels(db: Database, mailboxId: string) {
	const rows = await db
		.select()
		.from(labels)
		.where(eq(labels.mailboxId, mailboxId))
		.orderBy(labels.name);

	return rows.map(toLabelDto);
}

export async function getLabel(
	db: Database,
	mailboxId: string,
	labelId: string,
) {
	const [row] = await db
		.select()
		.from(labels)
		.where(and(eq(labels.id, labelId), eq(labels.mailboxId, mailboxId)))
		.limit(1);

	if (!row) {
		throw new Error("Label not found");
	}

	return toLabelDto(row);
}

export async function createLabel(
	db: Database,
	mailboxId: string,
	input: { name: string; color?: string | null },
) {
	const id = crypto.randomUUID();
	const now = new Date();

	try {
		const [row] = await db
			.insert(labels)
			.values({
				id,
				mailboxId,
				name: input.name.trim(),
				color: input.color ?? null,
				createdAt: now,
				updatedAt: now,
			})
			.returning();

		return toLabelDto(row);
	} catch {
		throw new Error("Label already exists for this mailbox");
	}
}

export async function updateLabel(
	db: Database,
	mailboxId: string,
	labelId: string,
	input: { name?: string; color?: string | null },
) {
	await getLabel(db, mailboxId, labelId);
	const now = new Date();

	const [row] = await db
		.update(labels)
		.set({
			...(input.name !== undefined ? { name: input.name.trim() } : {}),
			...(input.color !== undefined ? { color: input.color } : {}),
			updatedAt: now,
		})
		.where(and(eq(labels.id, labelId), eq(labels.mailboxId, mailboxId)))
		.returning();

	if (!row) {
		throw new Error("Label not found");
	}

	return toLabelDto(row);
}

export async function removeLabel(
	db: Database,
	mailboxId: string,
	labelId: string,
): Promise<void> {
	await getLabel(db, mailboxId, labelId);
	await db
		.delete(labels)
		.where(and(eq(labels.id, labelId), eq(labels.mailboxId, mailboxId)));
}
