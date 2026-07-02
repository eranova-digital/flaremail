import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	type ComposeForwardContext,
	type ComposeReplyContext,
	useComposeDraft,
} from "@/hooks/use-compose-draft";
import { ComposeAttachments } from "@/components/compose/ComposeAttachments";
import { ComposeForwardSource } from "@/components/compose/ComposeForwardSource";
import { getErrorMessage } from "@/lib/api/errors";

type ComposePaneProps = {
	mailboxId: string;
	existingDraftId?: string;
	reply?: ComposeReplyContext;
	forward?: ComposeForwardContext;
	onClose: () => void;
	onSent: () => void;
};

export function ComposePane({
	mailboxId,
	existingDraftId,
	reply,
	forward,
	onClose,
	onSent,
}: ComposePaneProps) {
	const compose = useComposeDraft(mailboxId, { reply, forward, existingDraftId });

	const handleSend = async () => {
		try {
			await compose.send();
			onSent();
		} catch {
			// error surfaced via compose.sendError
		}
	};

	if (!compose.initialized) {
		return (
			<div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
				<Loader2 className="size-4 animate-spin" />
				{existingDraftId
					? "Loading draft…"
					: reply
						? "Preparing reply…"
						: forward
							? "Preparing forward…"
							: "Loading…"}
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-between border-b px-4 py-3">
				<h2 className="font-medium">
					{existingDraftId
						? "Edit draft"
						: reply
							? "Reply"
							: forward
								? "Forward"
								: "New message"}
				</h2>
				<div className="flex items-center gap-2">
					{compose.isSaving ? (
						<span className="text-muted-foreground text-xs">Saving…</span>
					) : compose.draftId ? (
						<span className="text-muted-foreground text-xs">Draft saved</span>
					) : null}
					<Button variant="outline" onClick={onClose}>
						Close
					</Button>
					<Button
						onClick={() => void handleSend()}
						disabled={compose.isSending}
					>
						{compose.isSending ? (
							<>
								<Loader2 className="size-4 animate-spin" />
								Sending
							</>
						) : (
							"Send"
						)}
					</Button>
				</div>
			</div>
			<div className="space-y-3 overflow-auto p-4">
				<div className="space-y-2">
					<label className="text-sm font-medium" htmlFor="compose-to">
						To
					</label>
					<Input
						id="compose-to"
						value={compose.fields.to}
						onChange={(event) =>
							compose.updateFields({ to: event.target.value })
						}
						placeholder="recipient@example.com"
					/>
				</div>
				<div className="space-y-2">
					<label className="text-sm font-medium" htmlFor="compose-cc">
						Cc
					</label>
					<Input
						id="compose-cc"
						value={compose.fields.cc}
						onChange={(event) =>
							compose.updateFields({ cc: event.target.value })
						}
					/>
				</div>
				<div className="space-y-2">
					<label className="text-sm font-medium" htmlFor="compose-bcc">
						Bcc
					</label>
					<Input
						id="compose-bcc"
						value={compose.fields.bcc}
						onChange={(event) =>
							compose.updateFields({ bcc: event.target.value })
						}
					/>
				</div>
				<div className="space-y-2">
					<label className="text-sm font-medium" htmlFor="compose-subject">
						Subject
					</label>
					<Input
						id="compose-subject"
						value={compose.fields.subject}
						onChange={(event) =>
							compose.updateFields({ subject: event.target.value })
						}
					/>
				</div>
				{compose.forwardSource ? (
					<ComposeForwardSource source={compose.forwardSource} />
				) : null}
				<div className="space-y-2">
					<label className="text-sm font-medium" htmlFor="compose-body">
						{compose.forwardSource ? "Message" : "Body"}
					</label>
					<Textarea
						id="compose-body"
						className="min-h-[280px]"
						value={compose.fields.body}
						onChange={(event) =>
							compose.updateFields({ body: event.target.value })
						}
					/>
				</div>
				<ComposeAttachments
					attachments={compose.attachments}
					onChange={compose.updateAttachments}
					disabled={compose.isSending}
				/>
				{compose.saveError ? (
					<p className="text-destructive text-sm">{compose.saveError}</p>
				) : null}
				{compose.sendError ? (
					<p className="text-destructive text-sm">
						{getErrorMessage(compose.sendError)}
					</p>
				) : null}
			</div>
		</div>
	);
}
