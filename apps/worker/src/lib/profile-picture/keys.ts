export const PROFILE_PICTURE_SMALL_SIZE = 128;
export const PROFILE_PICTURE_LARGE_SIZE = 512;

export type ProfilePictureSize = "small" | "large";

export function profilePicturePixelSize(size: ProfilePictureSize): number {
	return size === "small"
		? PROFILE_PICTURE_SMALL_SIZE
		: PROFILE_PICTURE_LARGE_SIZE;
}

export function profilePictureStorageKey(
	accountId: string,
	size: ProfilePictureSize,
): string {
	return `profile/${accountId}/${size}.webp`;
}

export function allProfilePictureKeys(accountId: string): string[] {
	return [
		profilePictureStorageKey(accountId, "small"),
		profilePictureStorageKey(accountId, "large"),
	];
}

export function parseProfilePictureSize(
	value: string | null,
): ProfilePictureSize | null {
	if (value === "small" || value === "large") {
		return value;
	}
	return null;
}
