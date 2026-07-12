import { describe, expect, it } from "vitest";

import { profileAvatarColorsFromSeed } from "./profile-avatar-colors";

function hexToRgb(hex: string): [number, number, number] {
	const normalized = hex.replace("#", "");
	return [
		Number.parseInt(normalized.slice(0, 2), 16) / 255,
		Number.parseInt(normalized.slice(2, 4), 16) / 255,
		Number.parseInt(normalized.slice(4, 6), 16) / 255,
	];
}

function relativeLuminance(red: number, green: number, blue: number): number {
	const toLinear = (channel: number) => {
		if (channel <= 0.03928) {
			return channel / 12.92;
		}
		return ((channel + 0.055) / 1.055) ** 2.4;
	};

	const linearRed = toLinear(red);
	const linearGreen = toLinear(green);
	const linearBlue = toLinear(blue);

	return 0.2126 * linearRed + 0.7152 * linearGreen + 0.0722 * linearBlue;
}

function contrastRatio(luminanceA: number, luminanceB: number): number {
	const lighter = Math.max(luminanceA, luminanceB);
	const darker = Math.min(luminanceA, luminanceB);
	return (lighter + 0.05) / (darker + 0.05);
}

describe("profileAvatarColorsFromSeed", () => {
	it("returns stable colors for the same seed", () => {
		const first = profileAvatarColorsFromSeed("patrick@example.com");
		const second = profileAvatarColorsFromSeed("patrick@example.com");

		expect(first).toEqual(second);
	});

	it("normalizes seed casing and whitespace", () => {
		expect(profileAvatarColorsFromSeed(" Patrick@Example.com ")).toEqual(
			profileAvatarColorsFromSeed("patrick@example.com"),
		);
	});

	it("uses a pastel background and a high-contrast foreground", () => {
		const colors = profileAvatarColorsFromSeed("user@domain.test");
		const [red, green, blue] = hexToRgb(colors.background);
		const backgroundLuminance = relativeLuminance(red, green, blue);

		expect(backgroundLuminance).toBeGreaterThan(0.6);

		const foregroundLuminance =
			colors.foreground === "#ffffff" ? 1 : 0;
		const contrast = contrastRatio(backgroundLuminance, foregroundLuminance);

		expect(contrast).toBeGreaterThanOrEqual(4.5);
		expect(["#ffffff", "#000000"]).toContain(colors.foreground);
	});
});
