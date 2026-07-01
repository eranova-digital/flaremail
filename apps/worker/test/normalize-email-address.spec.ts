import { describe, expect, it } from "vitest";

import {
	buildEmailAddress,
	normalizeEmailAddress,
	parseEmailAddress,
} from "../src/lib/normalize-email-address";
import { isReceivingMailboxType } from "../src/lib/mailbox-types";
import {
	resolveCatchAllMailbox,
	resolveConfiguredMailbox,
} from "../src/lib/resolve-mailbox";

describe("normalizeEmailAddress", () => {
	it("lowercases and trims addresses", () => {
		expect(normalizeEmailAddress("  Support@Example.COM ")).toBe(
			"support@example.com",
		);
	});
});

describe("parseEmailAddress", () => {
	it("splits local part and domain", () => {
		expect(parseEmailAddress("support@example.com")).toEqual({
			localPart: "support",
			domain: "example.com",
		});
	});

	it("returns null for invalid addresses", () => {
		expect(parseEmailAddress("not-an-email")).toBeNull();
		expect(parseEmailAddress("@example.com")).toBeNull();
		expect(parseEmailAddress("user@")).toBeNull();
	});
});

describe("buildEmailAddress", () => {
	it("builds a normalized address", () => {
		expect(buildEmailAddress("Support", "Example.COM")).toBe(
			"support@example.com",
		);
	});
});

describe("isReceivingMailboxType", () => {
	it("treats primary, secondary, and shared as receiving mailboxes", () => {
		expect(isReceivingMailboxType("primary")).toBe(true);
		expect(isReceivingMailboxType("secondary")).toBe(true);
		expect(isReceivingMailboxType("shared")).toBe(true);
	});

	it("treats alias as non-receiving", () => {
		expect(isReceivingMailboxType("alias")).toBe(false);
	});
});

describe("resolveConfiguredMailbox", () => {
	const primary = {
		id: "primary-id",
		type: "primary" as const,
		aliasTargetId: null,
		aliasTargetAddress: null,
	};
	const secondary = {
		id: "secondary-id",
		type: "secondary" as const,
		aliasTargetId: null,
		aliasTargetAddress: null,
	};
	const shared = {
		id: "shared-id",
		type: "shared" as const,
		aliasTargetId: null,
		aliasTargetAddress: null,
	};
	const alias = {
		id: "alias-id",
		type: "alias" as const,
		aliasTargetId: "primary-id",
		aliasTargetAddress: null,
	};
	const mailboxById = new Map([
		["primary-id", primary],
		["secondary-id", secondary],
		["shared-id", shared],
		["alias-id", alias],
	]);

	it("resolves primary mailboxes exactly", () => {
		expect(resolveConfiguredMailbox(primary, mailboxById)).toEqual({
			action: "store",
			envelopeTo: "",
			actualMailboxId: "primary-id",
			matchedMailboxId: "primary-id",
			matchedVia: "exact",
		});
	});

	it("resolves secondary mailboxes exactly", () => {
		expect(resolveConfiguredMailbox(secondary, mailboxById)).toEqual({
			action: "store",
			envelopeTo: "",
			actualMailboxId: "secondary-id",
			matchedMailboxId: "secondary-id",
			matchedVia: "exact",
		});
	});

	it("resolves shared mailboxes exactly", () => {
		expect(resolveConfiguredMailbox(shared, mailboxById)).toEqual({
			action: "store",
			envelopeTo: "",
			actualMailboxId: "shared-id",
			matchedMailboxId: "shared-id",
			matchedVia: "exact",
		});
	});

	it("resolves alias mailboxes to their target mailbox", () => {
		expect(resolveConfiguredMailbox(alias, mailboxById)).toEqual({
			action: "store",
			envelopeTo: "",
			actualMailboxId: "primary-id",
			matchedMailboxId: "alias-id",
			matchedVia: "alias",
		});
	});

	it("allows aliases to target shared mailboxes", () => {
		const salesAlias = {
			id: "sales-alias-id",
			type: "alias" as const,
			aliasTargetId: "shared-id",
			aliasTargetAddress: null,
		};
		const map = new Map(mailboxById);
		map.set("sales-alias-id", salesAlias);

		expect(resolveConfiguredMailbox(salesAlias, map)).toEqual({
			action: "store",
			envelopeTo: "",
			actualMailboxId: "shared-id",
			matchedMailboxId: "sales-alias-id",
			matchedVia: "alias",
		});
	});

	it("forwards alias mailboxes with external targets", () => {
		const externalAlias = {
			id: "external-alias-id",
			type: "alias" as const,
			aliasTargetId: null,
			aliasTargetAddress: "patrick@gmail.com",
		};
		const map = new Map(mailboxById);
		map.set("external-alias-id", externalAlias);

		expect(resolveConfiguredMailbox(externalAlias, map)).toEqual({
			action: "forward",
			envelopeTo: "",
			forwardTo: "patrick@gmail.com",
			matchedMailboxId: "external-alias-id",
		});
	});

	it("returns null when alias target is missing", () => {
		expect(
			resolveConfiguredMailbox(
				{
					id: "alias-id",
					type: "alias",
					aliasTargetId: null,
					aliasTargetAddress: null,
				},
				mailboxById,
			),
		).toBeNull();
	});
});

describe("resolveCatchAllMailbox", () => {
	it("returns catch-all resolution when configured", () => {
		expect(resolveCatchAllMailbox("shared-id")).toEqual({
			action: "store",
			envelopeTo: "",
			actualMailboxId: "shared-id",
			matchedMailboxId: null,
			matchedVia: "catch_all",
		});
	});

	it("returns null when catch-all mailbox is not configured", () => {
		expect(resolveCatchAllMailbox(null)).toBeNull();
	});
});
