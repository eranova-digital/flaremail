import {
	BIMI_LOGO_LARGE_SIZE,
	BIMI_LOGO_SMALL_SIZE,
} from "./constants";

export type BimiLogoSize = "small" | "large";

export function bimiLogoPixelSize(size: BimiLogoSize): number {
	return size === "small" ? BIMI_LOGO_SMALL_SIZE : BIMI_LOGO_LARGE_SIZE;
}

/** R2 object key for a BIMI logo variant. */
export function bimiLogoStorageKey(domain: string, size: BimiLogoSize): string {
	return `bimi/${domain.toLowerCase()}/${size}.webp`;
}

/** Base prefix stored on `bimi_logos.storage_key` when found. */
export function bimiLogoStoragePrefix(domain: string): string {
	return `bimi/${domain.toLowerCase()}`;
}

export function allBimiLogoKeys(domain: string): string[] {
	return [
		bimiLogoStorageKey(domain, "small"),
		bimiLogoStorageKey(domain, "large"),
	];
}

export function parseBimiLogoSize(value: string | null): BimiLogoSize | null {
	if (value === "small" || value === "large") {
		return value;
	}
	return null;
}
