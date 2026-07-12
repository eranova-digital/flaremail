export type ProfileAvatarColors = {
	background: string;
	foreground: string;
};

function hashString(input: string): number {
	let hash = 0;
	for (let index = 0; index < input.length; index += 1) {
		hash = (hash << 5) - hash + input.charCodeAt(index);
		hash |= 0;
	}
	return Math.abs(hash);
}

function hslToRgb(
	hue: number,
	saturation: number,
	lightness: number,
): [number, number, number] {
	const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
	const hueSegment = hue / 60;
	const secondary = chroma * (1 - Math.abs((hueSegment % 2) - 1));
	let red = 0;
	let green = 0;
	let blue = 0;

	if (hueSegment >= 0 && hueSegment < 1) {
		red = chroma;
		green = secondary;
	} else if (hueSegment >= 1 && hueSegment < 2) {
		red = secondary;
		green = chroma;
	} else if (hueSegment >= 2 && hueSegment < 3) {
		green = chroma;
		blue = secondary;
	} else if (hueSegment >= 3 && hueSegment < 4) {
		green = secondary;
		blue = chroma;
	} else if (hueSegment >= 4 && hueSegment < 5) {
		red = secondary;
		blue = chroma;
	} else {
		red = chroma;
		blue = secondary;
	}

	const match = lightness - chroma / 2;
	return [red + match, green + match, blue + match];
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

function rgbToHex(red: number, green: number, blue: number): string {
	const toChannel = (channel: number) =>
		Math.round(Math.min(255, Math.max(0, channel * 255)))
			.toString(16)
			.padStart(2, "0");

	return `#${toChannel(red)}${toChannel(green)}${toChannel(blue)}`;
}

/**
 * Derives avatar colors from a stable seed (typically the account's primary address).
 * The background is a deterministic pastel; the foreground maximizes contrast.
 */
export function profileAvatarColorsFromSeed(seed: string): ProfileAvatarColors {
	const normalized = seed.trim().toLowerCase();
	const hash = hashString(normalized);

	const hue = hash % 360;
	const saturation = 40 + (hash % 16);
	const lightness = 78 + (hash % 8);

	const [red, green, blue] = hslToRgb(hue, saturation / 100, lightness / 100);
	const background = rgbToHex(red, green, blue);
	const backgroundLuminance = relativeLuminance(red, green, blue);

	const whiteContrast = contrastRatio(backgroundLuminance, 1);
	const blackContrast = contrastRatio(backgroundLuminance, 0);
	const foreground = whiteContrast >= blackContrast ? "#ffffff" : "#000000";

	return { background, foreground };
}
