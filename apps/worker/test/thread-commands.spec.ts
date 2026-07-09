import { describe, expect, it } from "vitest";

import { planThreadAction } from "../src/lib/thread-mailbox/plan-thread-action";
import { runThreadAction } from "../src/services/thread-commands";

describe("planThreadAction", () => {
	const now = new Date("2026-01-01T12:00:00Z");

	it("snapshots sent folder before trash", () => {
		const plan = planThreadAction(
			{ folder: "sent", restoreFolder: null },
			"trash",
			now,
		);
		expect(plan).toEqual({
			kind: "update",
			patch: {
				restoreFolder: "sent",
				folder: "trash",
				trashedAt: now,
			},
		});
	});

	it("restore returns thread to snapshotted sent folder", () => {
		const plan = planThreadAction(
			{ folder: "trash", restoreFolder: "sent" },
			"restore",
			now,
		);
		expect(plan).toEqual({
			kind: "update",
			patch: {
				folder: "sent",
				restoreFolder: null,
				archivedAt: null,
				trashedAt: null,
				markedAsSpamAt: null,
			},
		});
	});

	it("noops when already archived", () => {
		expect(
			planThreadAction({ folder: "archived", restoreFolder: "inbox" }, "archive"),
		).toEqual({ kind: "noop" });
	});

	it("defaults restore target to inbox when no snapshot", () => {
		const plan = planThreadAction(
			{ folder: "trash", restoreFolder: null },
			"restore",
		);
		expect(plan.kind === "update" && plan.patch.folder).toBe("inbox");
	});
});

describe("thread restore folder snapshot", () => {
	it("exports restore action", () => {
		expect(typeof runThreadAction).toBe("function");
	});
});
