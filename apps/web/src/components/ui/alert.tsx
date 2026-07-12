import { cva, type VariantProps } from "class-variance-authority";
import {
	AlertTriangle,
	CheckCircle2,
	Info,
	XCircle,
} from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva(
	"flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-sm",
	{
		variants: {
			tone: {
				info: "border-primary/20 bg-primary/5 text-foreground",
				success:
					"border-emerald-600/25 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
				warning:
					"border-amber-600/25 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
				destructive:
					"border-destructive/25 bg-destructive/5 text-destructive dark:bg-destructive/10",
			},
		},
		defaultVariants: {
			tone: "info",
		},
	},
);

const toneIcons = {
	info: Info,
	success: CheckCircle2,
	warning: AlertTriangle,
	destructive: XCircle,
} as const;

export interface AlertProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof alertVariants> {
	title?: string;
}

export function Alert({
	className,
	tone = "info",
	title,
	children,
	...props
}: AlertProps) {
	const Icon = toneIcons[tone ?? "info"];
	return (
		<div
			role={tone === "destructive" ? "alert" : "status"}
			className={cn(alertVariants({ tone }), className)}
			{...props}
		>
			<Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
			<div className="min-w-0 flex-1 space-y-0.5">
				{title ? <p className="font-medium">{title}</p> : null}
				{children ? <div className="[&_p]:leading-relaxed">{children}</div> : null}
			</div>
		</div>
	);
}
