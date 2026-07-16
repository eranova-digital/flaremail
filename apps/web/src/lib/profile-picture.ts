import { apiUrl } from "@/lib/api";

export type ProfilePictureSize = "small" | "large";

export type ProfilePicture = {
	updatedAt?: string;
};

export function profilePictureUrl(
	accountId: string,
	size: ProfilePictureSize,
	profilePicture: ProfilePicture | null | undefined,
): string | null {
	if (!profilePicture?.updatedAt) {
		return null;
	}

	const params = new URLSearchParams({
		size,
		v: profilePicture.updatedAt,
	});

	return apiUrl(`/accounts/${accountId}/profile-picture?${params.toString()}`);
}

export function pickProfilePictureSize(className: string): ProfilePictureSize {
	return /\bsize-(1[6-9]|[2-9]\d|\d{3,})\b/.test(className) ? "large" : "small";
}
