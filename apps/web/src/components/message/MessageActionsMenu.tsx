import { FileCode2, Forward, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { MessageOriginalDialog } from "@/components/message/MessageOriginalDialog";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ThreadFolder } from "@/lib/api/client";

type MessageActionsMenuProps = {
	messageId: string;
	mailboxId: string;
	threadId: string;
	folder: ThreadFolder;
};

export function MessageActionsMenu({
	messageId,
	mailboxId,
	threadId,
	folder,
}: MessageActionsMenuProps) {
	const { t } = useTranslation("mail");
	const navigate = useNavigate();
	const [originalOpen, setOriginalOpen] = useState(false);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						className="size-7"
						aria-label={t("message.actions")}
					>
						<MoreHorizontal className="size-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem
						onClick={() =>
							navigate(
								`/m/${mailboxId}/compose?forward=${messageId}&threadId=${threadId}&folder=${folder}`,
							)
						}
					>
						<Forward />
						{t("message.forward")}
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => setOriginalOpen(true)}>
						<FileCode2 />
						{t("message.viewOriginal")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<MessageOriginalDialog
				open={originalOpen}
				onOpenChange={setOriginalOpen}
				messageId={messageId}
				mailboxId={mailboxId}
			/>
		</>
	);
}
