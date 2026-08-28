import { cn } from "@/lib/utils";
import { bimiLogoUrl, pickBimiLogoSize } from "@/lib/bimi";

type BimiAvatarProps = {
	domain: string;
	className?: string;
	updatedAt?: string | null;
};

/** BIMI brand mark only — no initials fallback when missing. */
export function BimiAvatar({ domain, className, updatedAt }: BimiAvatarProps) {
	return (
		<img
			src={bimiLogoUrl(domain, pickBimiLogoSize(className ?? ""), updatedAt)}
			alt=""
			aria-hidden
			className={cn("bg-muted inline-block size-6 shrink-0 rounded-full object-cover", className)}
		/>
	);
}
