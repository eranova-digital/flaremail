/** Absolute profile picture URL for OIDC `picture` claims (public GET). */
export function oidcProfilePictureClaimUrl(
	issuer: string,
	accountId: string,
	updatedAt: Date | null | undefined,
	size: "small" | "large" = "large",
): string | undefined {
	if (!updatedAt) {
		return undefined;
	}
	const params = new URLSearchParams({
		size,
		v: updatedAt.toISOString(),
	});
	return `${issuer.replace(/\/$/, "")}/api/v1/accounts/${accountId}/profile-picture?${params.toString()}`;
}
