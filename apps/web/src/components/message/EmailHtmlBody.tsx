import { useCallback, useState } from "react";

import { EmailLinkDialog } from "@/components/message/EmailLinkDialog";
import {
	findEmailLinkFromEvent,
	isNavigableEmailLink,
	openEmailLinkInNewTab,
} from "@/lib/email-links";

type EmailHtmlBodyProps = {
	html: string;
};

export function EmailHtmlBody({ html }: EmailHtmlBodyProps) {
	const [pendingLink, setPendingLink] = useState<string | null>(null);

	const handleLinkActivation = useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			const anchor = findEmailLinkFromEvent(event.target);
			if (!anchor) {
				return;
			}

			const href = anchor.getAttribute("href");
			if (!isNavigableEmailLink(href)) {
				event.preventDefault();
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			setPendingLink(href);
		},
		[],
	);

	const handleConfirm = useCallback(() => {
		if (pendingLink) {
			openEmailLinkInNewTab(pendingLink);
		}
		setPendingLink(null);
	}, [pendingLink]);

	return (
		<>
			<div
				className="message-html-body text-sm"
				dangerouslySetInnerHTML={{ __html: html }}
				onClick={handleLinkActivation}
				onAuxClick={handleLinkActivation}
			/>
			<EmailLinkDialog
				open={pendingLink !== null}
				href={pendingLink}
				onOpenChange={(open) => {
					if (!open) {
						setPendingLink(null);
					}
				}}
				onConfirm={handleConfirm}
			/>
		</>
	);
}
