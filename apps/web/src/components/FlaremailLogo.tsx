import { cn } from "@/lib/utils";

type FlaremailLogoProps = {
	className?: string;
};

export function FlaremailLogo({ className }: FlaremailLogoProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 1000 1000"
			className={cn("shrink-0", className)}
			aria-hidden
		>
			<path
				fill="currentColor"
				d="M665.63,14.32q-72.88,403.5,242.68,503.22-376.53,13.51-574.63,468.05,100.54-410.99-242.24-468.05Q455.14,440.47,665.63,14.32Z"
			/>
		</svg>
	);
}
