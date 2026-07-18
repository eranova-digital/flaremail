import type { Account } from "@/lib/auth/types";
import { profileAvatarColorsFromSeed } from "@/lib/profile-avatar-colors";
import {
	pickProfilePictureSize,
	profilePictureUrl,
	type ProfilePicture,
} from "@/lib/profile-picture";
import { cn } from "@/lib/utils";

export function getAccountDisplayName(account: Account): string {
	if (account.displayName) {
		return account.displayName;
	}
	const parts = [account.profile?.firstName, account.profile?.lastName].filter(
		Boolean,
	);
	if (parts.length > 0) {
		return parts.join(" ");
	}
	return account.loginIdentifier;
}

export function getInitialsFromLabel(label: string): string {
	const words = label.split(/\s+/).filter(Boolean);
	if (words.length === 0) {
		return "?";
	}
	if (words.length === 1) {
		return words[0].slice(0, 2).toUpperCase();
	}
	return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export type ProfileAvatarShape = "circle" | "rounded-square";

type ProfileAvatarProps = {
	seed: string;
	label: string;
	className?: string;
	/** Defaults to circle (accounts). Use rounded-square for OIDC clients. */
	shape?: ProfileAvatarShape;
	/** Explicit image URL (e.g. OIDC client logo). Wins over account picture. */
	imageUrl?: string | null;
	accountId?: string;
	profilePicture?: ProfilePicture | null;
};

function shapeClass(shape: ProfileAvatarShape): string {
	return shape === "rounded-square" ? "rounded-lg" : "rounded-full";
}

export function ProfileAvatar({
	seed,
	label,
	className,
	shape = "circle",
	imageUrl: imageUrlProp,
	accountId,
	profilePicture,
}: ProfileAvatarProps) {
	const { background, foreground } = profileAvatarColorsFromSeed(seed);
	const initials = getInitialsFromLabel(label);
	const imageUrl =
		imageUrlProp !== undefined
			? imageUrlProp
			: accountId
				? profilePictureUrl(
						accountId,
						pickProfilePictureSize(className ?? ""),
						profilePicture,
					)
				: null;
	const radius = shapeClass(shape);

	if (imageUrl) {
		return (
			<img
				src={imageUrl}
				alt=""
				aria-hidden
				className={cn("shrink-0 object-cover", radius, className)}
			/>
		);
	}

	return (
		<span
			aria-hidden
			className={cn(
				"flex shrink-0 items-center justify-center font-semibold",
				radius,
				className,
			)}
			style={{ backgroundColor: background, color: foreground }}
		>
			{initials}
		</span>
	);
}
