import { useTranslation } from "react-i18next";

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
	const { t } = useTranslation("mail");
	const { t: tc } = useTranslation("common");

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{t("linkDialog.title")}</DialogTitle>
					<DialogDescription asChild>
						<div className="text-muted-foreground space-y-2 text-sm">
							<p>{t("linkDialog.description")}</p>
							<p className="text-foreground break-all font-medium">{href}</p>
						</div>
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						{tc("cancel")}
					</Button>
					<Button onClick={onConfirm}>{t("linkDialog.open")}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
