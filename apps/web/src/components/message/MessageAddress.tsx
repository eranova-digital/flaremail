import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { parseEmailAddressDisplay } from "@/lib/format-email-address";
import { cn } from "@/lib/utils";

type MessageAddressProps = {
	address?: string | null;
	className?: string;
};

export function MessageAddress({ address, className }: MessageAddressProps) {
	const parsed = parseEmailAddressDisplay(address);

	if (parsed.hasDisplayName) {
		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<span className={cn("truncate", className)}>{parsed.display}</span>
				</TooltipTrigger>
				<TooltipContent>{parsed.email}</TooltipContent>
			</Tooltip>
		);
	}

	return (
		<span className={cn("truncate", className)} title={parsed.display}>
			{parsed.display}
		</span>
	);
}
