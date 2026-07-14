import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

type EmailLinkDialogProps = {
	open: boolean;
	href: string | null;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
};

export function EmailLinkDialog({
	open,
	href,
	onOpenChange,
	onConfirm,
}: EmailLinkDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Open external link?</DialogTitle>
					<DialogDescription asChild>
						<div className="text-muted-foreground space-y-2 text-sm">
							<p>You are about to leave Flaremail and open this link in a new tab:</p>
							<p className="text-foreground break-all font-medium">{href}</p>
						</div>
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={onConfirm}>Open link</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
