import type { ReactNode } from "react";
import { PenLine } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SandboxedHtml } from "@/components/html/SandboxedHtml";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Identity } from "@/lib/identities/api";
import { cn } from "@/lib/utils";

export function identityDisplayName(
	identity: Identity,
	noNameLabel = "(no name)",
): string {
	const name = identity.fromNamePreview.trim();
	return name.length > 0 ? name : noNameLabel;
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
	const { t } = useTranslation("settings");
	const displayName = identityDisplayName(identity, t("identities.noName"));
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
								<Badge variant="secondary">{t("identities.badgeDefault")}</Badge>
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
						{t("identities.signatureLabel")}
					</div>
					{hasSignature ? (
						<SandboxedHtml
							title={t("identities.signatureTitle")}
							html={identity.signatureHtml ?? ""}
							className="text-muted-foreground min-h-[3rem] text-xs"
							bodyCss="body { font-size: 0.75rem; line-height: 1.4; color: #525252; } p { margin: 0 0 0.35em; }"
						/>
					) : (
						<p className="text-muted-foreground text-xs">
							{t("identities.noSignature")}
						</p>
					)}
				</div>

				{footer ? <div className="space-y-3">{footer}</div> : null}
			</CardContent>
		</Card>
	);
}
