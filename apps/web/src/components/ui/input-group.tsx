import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			role="group"
			data-slot="input-group"
			className={cn(
				"border-input bg-background has-[[data-slot=input-group-control]:focus-visible]:ring-ring flex h-9 w-full min-w-0 items-stretch overflow-hidden rounded-md border shadow-sm transition-colors has-[[data-slot=input-group-control]:focus-visible]:ring-1",
				className,
			)}
			{...props}
		/>
	);
}

const inputGroupAddonVariants = cva(
	"text-muted-foreground flex shrink-0 items-center gap-1 px-3 text-sm select-none",
	{
		variants: {
			align: {
				"inline-start": "border-r",
				"inline-end": "border-l",
			},
		},
		defaultVariants: {
			align: "inline-start",
		},
	},
);

function InputGroupAddon({
	className,
	align = "inline-start",
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
	return (
		<div
			data-slot="input-group-addon"
			data-align={align}
			className={cn(
				inputGroupAddonVariants({ align }),
				"border-border bg-muted/30",
				className,
			)}
			{...props}
		/>
	);
}

const InputGroupInput = React.forwardRef<
	HTMLInputElement,
	React.ComponentProps<"input">
>(({ className, type, ...props }, ref) => {
	return (
		<input
			ref={ref}
			type={type}
			data-slot="input-group-control"
			className={cn(
				"placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent px-3 py-1 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	);
});
InputGroupInput.displayName = "InputGroupInput";

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			className={cn("text-muted-foreground text-sm whitespace-nowrap", className)}
			{...props}
		/>
	);
}

export { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText };
