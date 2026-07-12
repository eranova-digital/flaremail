import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

type ConfirmDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: ReactNode;
	confirmLabel: string;
	onConfirm: () => void;
	pending?: boolean;
};

/**
 * Confirmation dialog for destructive actions. Replaces `window.confirm`
 * with a consistent, keyboard-accessible surface that names the consequence.
 */
export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel,
	onConfirm,
	pending = false,
}: ConfirmDialogProps) {
	return (
		<Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription asChild>
						<div className="text-muted-foreground space-y-1 text-sm">
							{description}
						</div>
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={pending}
					>
						Cancel
					</Button>
					<Button variant="destructive" onClick={onConfirm} disabled={pending}>
						{pending ? (
							<Loader2 className="size-4 animate-spin" aria-hidden />
						) : null}
						{confirmLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
