import {
	PROFILE_PICTURE_LARGE_SIZE,
	PROFILE_PICTURE_SMALL_SIZE,
	type ProfilePictureSize,
} from "../profile-picture/keys";

export const OIDC_CLIENT_LOGO_SMALL_SIZE = PROFILE_PICTURE_SMALL_SIZE;
export const OIDC_CLIENT_LOGO_LARGE_SIZE = PROFILE_PICTURE_LARGE_SIZE;

export type OidcClientLogoSize = ProfilePictureSize;

export function oidcClientLogoStorageKey(
	clientRecordId: string,
	size: OidcClientLogoSize,
): string {
	return `oidc-clients/${clientRecordId}/${size}.webp`;
}

export function allOidcClientLogoKeys(clientRecordId: string): string[] {
	return [
		oidcClientLogoStorageKey(clientRecordId, "small"),
		oidcClientLogoStorageKey(clientRecordId, "large"),
	];
}

export function parseOidcClientLogoSize(
	value: string | null,
): OidcClientLogoSize | null {
	if (value === "small" || value === "large") {
		return value;
	}
	return null;
}
