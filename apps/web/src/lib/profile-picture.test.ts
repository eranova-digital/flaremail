import { describe, expect, it } from "vitest";

import { pickProfilePictureSize, profilePictureUrl } from "@/lib/profile-picture";

describe("profilePictureUrl", () => {
	it("returns null when no profile picture is set", () => {
		expect(
			profilePictureUrl("account-id", "small", null),
		).toBeNull();
	});

	it("builds a cache-busted URL for the requested size", () => {
		const url = profilePictureUrl("account-id", "large", {
			updatedAt: "2026-07-13T18:00:00.000Z",
		});
		expect(url).toContain("/accounts/account-id/profile-picture?");
		expect(url).toContain("size=large");
		expect(url).toContain(
			encodeURIComponent("2026-07-13T18:00:00.000Z"),
		);
	});
});

describe("pickProfilePictureSize", () => {
	it("uses large avatars for bigger UI slots", () => {
		expect(pickProfilePictureSize("size-16 text-lg")).toBe("large");
		expect(pickProfilePictureSize("size-8 text-xs")).toBe("small");
	});
});
