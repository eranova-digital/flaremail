import { describe, expect, it } from "vitest";

import {
	canAccessOrganizationSettings,
	getOrganizationPolicies,
	getSecurityRequirements,
	roleRequiresMfa,
} from "../src/services/security-compliance";

describe("roleRequiresMfa", () => {
	it("returns false when scope is none", () => {
		expect(roleRequiresMfa("admin", "none")).toBe(false);
	});

	it("returns true for all roles when scope is all", () => {
		expect(roleRequiresMfa("user", "all")).toBe(true);
		expect(roleRequiresMfa("superadmin", "all")).toBe(true);
	});

	it("applies minimum role thresholds", () => {
		expect(roleRequiresMfa("user", "manager_and_above")).toBe(false);
		expect(roleRequiresMfa("manager", "manager_and_above")).toBe(true);
		expect(roleRequiresMfa("admin", "admin_and_above")).toBe(true);
		expect(roleRequiresMfa("manager", "admin_and_above")).toBe(false);
		expect(roleRequiresMfa("superadmin", "superadmin_and_above")).toBe(true);
		expect(roleRequiresMfa("admin", "superadmin_and_above")).toBe(false);
	});
});

describe("getSecurityRequirements", () => {
	const settings = {
		organizationTabAccess: "intendant_only" as const,
		requireMfaScope: "manager_and_above" as const,
		requireRecoveryEmail: true,
	};

	it("exempts the intendant", () => {
		expect(
			getSecurityRequirements(
				{
					isIntendant: true,
					role: null,
					profile: { recoveryAddress: null },
					mfaEnabled: false,
				},
				settings,
			),
		).toEqual({ recoveryEmail: false, mfa: false });
	});

	it("requires recovery email and mfa when missing", () => {
		expect(
			getSecurityRequirements(
				{
					isIntendant: false,
					role: "manager",
					profile: { recoveryAddress: null },
					mfaEnabled: false,
				},
				settings,
			),
		).toEqual({ recoveryEmail: true, mfa: true });
	});

	it("clears satisfied requirements", () => {
		expect(
			getSecurityRequirements(
				{
					isIntendant: false,
					role: "manager",
					profile: { recoveryAddress: "backup@example.com" },
					mfaEnabled: true,
				},
				settings,
			),
		).toEqual({ recoveryEmail: false, mfa: false });
	});
});

describe("getOrganizationPolicies", () => {
	it("returns active policy flags for scoped accounts", () => {
		expect(
			getOrganizationPolicies(
				{ isIntendant: false, role: "admin" },
				{
					organizationTabAccess: "intendant_only",
					requireMfaScope: "admin_and_above",
					requireRecoveryEmail: true,
				},
			),
		).toEqual({
			mfaRequired: true,
			recoveryEmailRequired: true,
		});
	});
});

describe("canAccessOrganizationSettings", () => {
	const settings = {
		organizationTabAccess: "intendant_and_superadmins" as const,
		requireMfaScope: "none" as const,
		requireRecoveryEmail: false,
	};

	it("allows the intendant always", () => {
		expect(
			canAccessOrganizationSettings(
				{ isIntendant: true, role: null },
				settings,
			),
		).toBe(true);
	});

	it("allows superadmins when configured", () => {
		expect(
			canAccessOrganizationSettings(
				{ isIntendant: false, role: "superadmin" },
				settings,
			),
		).toBe(true);
	});

	it("denies other roles", () => {
		expect(
			canAccessOrganizationSettings(
				{ isIntendant: false, role: "admin" },
				settings,
			),
		).toBe(false);
	});
});
