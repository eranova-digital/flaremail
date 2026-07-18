import type { ReactNode } from "react";
import { PenLine } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Identity } from "@/lib/identities/api";
import { cn } from "@/lib/utils";

export function identityDisplayName(identity: Identity): string {
	const name = identity.fromNamePreview.trim();
	return name.length > 0 ? name : "(no name)";
}

type IdentityCardProps = {
	identity: Identity;
	/** Mailbox address shown under the name (From address context). */
	mailboxAddress?: string | null;
	/** Extra badges beyond the automatic Default badge. */
	badges?: ReactNode;
	/** Extra muted line under the meta row (e.g. scope note). */
	description?: ReactNode;
	/** Edit / delete controls. */
	actions?: ReactNode;
	/** Inline form or help text below the signature. */
	footer?: ReactNode;
	/** Dim the card (read-only / managed elsewhere). */
	disabled?: boolean;
	className?: string;
};

export function IdentityCard({
	identity,
	mailboxAddress,
	badges,
	description,
	actions,
	footer,
	disabled = false,
	className,
}: IdentityCardProps) {
	const displayName = identityDisplayName(identity);
	const hasSignature = Boolean(identity.signatureHtml?.trim());
	const address = mailboxAddress?.trim() || null;

	return (
		<Card
			className={cn(
				"gap-0 rounded-xl py-0 shadow-sm",
				disabled && "opacity-60",
				className,
			)}
		>
			<CardContent className="space-y-3 p-4">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 space-y-1">
						<div className="flex flex-wrap items-center gap-2">
							<h3 className="truncate text-sm font-semibold tracking-tight">
								{displayName}
							</h3>
							{identity.isDefault ? (
								<Badge variant="secondary">Default</Badge>
							) : null}
							{badges}
						</div>
						{address ? (
							<p className="text-muted-foreground truncate text-xs">{address}</p>
						) : null}
						{description ? (
							<div className="text-muted-foreground text-xs leading-relaxed">
								{description}
							</div>
						) : null}
					</div>
					{actions ? (
						<div className="flex shrink-0 items-center gap-0.5">{actions}</div>
					) : null}
				</div>

				<div
					className={cn(
						"rounded-lg border px-3 py-2.5",
						hasSignature
							? "bg-muted/40 border-border/80"
							: "border-dashed bg-transparent",
					)}
				>
					<div className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase">
						<PenLine className="size-3" aria-hidden />
						Signature
					</div>
					{hasSignature ? (
						<div
							className="text-muted-foreground prose prose-sm max-w-none text-xs [&_p]:my-0 [&_p+p]:mt-1.5"
							dangerouslySetInnerHTML={{
								__html: identity.signatureHtml ?? "",
							}}
						/>
					) : (
						<p className="text-muted-foreground text-xs">No signature</p>
					)}
				</div>

				{footer ? <div className="space-y-3">{footer}</div> : null}
			</CardContent>
		</Card>
	);
}
