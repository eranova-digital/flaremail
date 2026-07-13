export type ProfilePicturePayload = {
	updatedAt: string;
};

export function toProfilePicturePayload(
	updatedAt: Date | null | undefined,
): ProfilePicturePayload | null {
	if (!updatedAt) {
		return null;
	}

	return { updatedAt: updatedAt.toISOString() };
}
