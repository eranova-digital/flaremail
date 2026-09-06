import { Pencil, Tag } from "lucide-react";
import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useParams } from "react-router-dom";

import { ManageLabelsDialog } from "@/components/layout/ManageLabelsDialog";
import { Button } from "@/components/ui/button";
import { useLabels } from "@/hooks/use-labels";
import { DEFAULT_LABEL_COLOR } from "@/lib/label-colors";
import { cn } from "@/lib/utils";

type LabelsSectionProps = {
	collapsed: boolean;
	onNavigate?: () => void;
	withTooltip: (label: string, trigger: ReactElement) => ReactElement;
};

export function LabelsSection({ collapsed, onNavigate, withTooltip }: LabelsSectionProps) {
	const { t } = useTranslation("mail");
	const { t: tc } = useTranslation("common");
	const { mailboxId, labelId: activeLabelId } = useParams();
	const [manageOpen, setManageOpen] = useState(false);
	const labelsQuery = useLabels(mailboxId ?? "");
	const labels = labelsQuery.data ?? [];

	if (!mailboxId) {
		return null;
	}

	const manageLabel = t("labels.manage");

	const header = collapsed ? null : (
		<div className="flex items-center justify-between px-3 pb-1 pt-2">
			<span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
				{t("labels.title")}
			</span>
			<Button
				variant="ghost"
				size="icon"
				className="size-6"
				aria-label={manageLabel}
				onClick={() => setManageOpen(true)}
			>
				<Pencil className="size-3" />
			</Button>
		</div>
	);

	const manageButton = collapsed
		? withTooltip(
				manageLabel,
				<Button
					variant="ghost"
					size="icon"
					className="mx-auto size-9"
					aria-label={manageLabel}
					onClick={() => setManageOpen(true)}
				>
					<Tag className="size-4" />
				</Button>,
			)
		: null;

	return (
		<>
			{header}
			{manageButton}
			{labelsQuery.isLoading && !collapsed ? (
				<p className="text-muted-foreground px-3 py-1 text-xs">{tc("loading")}</p>
			) : null}
			{labels.map((label) => {
				if (!label.id) {
					return null;
				}
				const link = (
					<NavLink
						to={`/m/${mailboxId}/labels/${label.id}`}
						onClick={() => onNavigate?.()}
						className={({ isActive }) =>
							cn(
								"hover:bg-accent flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
								collapsed && "justify-center px-0",
								(isActive || activeLabelId === label.id) &&
									"bg-accent text-accent-foreground font-medium",
							)
						}
					>
						<span
							className="size-3 shrink-0 rounded-full"
							style={{ backgroundColor: label.color ?? DEFAULT_LABEL_COLOR }}
						/>
						{!collapsed ? (
							<span className="min-w-0 truncate">{label.name}</span>
						) : null}
					</NavLink>
				);
				return (
					<div key={label.id}>
						{collapsed
							? withTooltip(label.name ?? t("labels.fallback"), link)
							: link}
					</div>
				);
			})}
			{!collapsed && labels.length === 0 && !labelsQuery.isLoading ? (
				<button
					type="button"
					className="text-primary hover:text-primary/80 px-3 py-1 text-left text-xs font-medium underline-offset-4 hover:underline"
					onClick={() => setManageOpen(true)}
				>
					{t("labels.addFirst")}
				</button>
			) : null}
			<ManageLabelsDialog
				mailboxId={mailboxId}
				open={manageOpen}
				onOpenChange={setManageOpen}
			/>
		</>
	);
}
