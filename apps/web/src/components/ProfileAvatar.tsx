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

type ProfileAvatarProps = {
	accountId: string;
	seed: string;
	label: string;
	profilePicture?: ProfilePicture | null;
	className?: string;
};

export function ProfileAvatar({
	accountId,
	seed,
	label,
	profilePicture,
	className,
}: ProfileAvatarProps) {
	const { background, foreground } = profileAvatarColorsFromSeed(seed);
	const initials = getInitialsFromLabel(label);
	const imageUrl = profilePictureUrl(
		accountId,
		pickProfilePictureSize(className ?? ""),
		profilePicture,
	);

	if (imageUrl) {
		return (
			<img
				src={imageUrl}
				alt=""
				aria-hidden
				className={cn(
					"shrink-0 rounded-full object-cover",
					className,
				)}
			/>
		);
	}

	return (
		<span
			aria-hidden
			className={cn(
				"flex shrink-0 items-center justify-center rounded-full font-semibold",
				className,
			)}
			style={{ backgroundColor: background, color: foreground }}
		>
			{initials}
		</span>
	);
}
