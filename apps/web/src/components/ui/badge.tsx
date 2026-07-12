import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors",
	{
		variants: {
			variant: {
				default:
					"border-transparent bg-primary text-primary-foreground shadow",
				secondary:
					"border-transparent bg-secondary text-secondary-foreground",
				outline: "text-foreground",
				success:
					"border-emerald-600/25 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
				warning:
					"border-amber-600/25 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
				destructive:
					"border-destructive/25 bg-destructive/5 text-destructive dark:bg-destructive/15",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

export interface BadgeProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
	return (
		<div className={cn(badgeVariants({ variant }), className)} {...props} />
	);
}

export { Badge, badgeVariants };
