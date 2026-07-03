import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	useCreateLabel,
	useDeleteLabel,
	useLabels,
	useUpdateLabel,
} from "@/hooks/use-labels";
import type { Label } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { DEFAULT_LABEL_COLOR, LABEL_COLORS } from "@/lib/label-colors";
import { cn } from "@/lib/utils";

type ManageLabelsDialogProps = {
	mailboxId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

function ColorSwatches({
	value,
	onChange,
}: {
	value: string | null | undefined;
	onChange: (color: string) => void;
}) {
	const selected = value ?? DEFAULT_LABEL_COLOR;

	return (
		<div className="flex flex-wrap gap-1.5">
			{LABEL_COLORS.map((color) => (
				<button
					key={color}
					type="button"
					className={cn(
						"size-6 rounded-full border-2 transition-transform hover:scale-110",
						selected === color ? "border-foreground scale-110" : "border-transparent",
					)}
					style={{ backgroundColor: color }}
					aria-label={`Color ${color}`}
					onClick={() => onChange(color)}
				/>
			))}
		</div>
	);
}

function LabelRow({
	mailboxId,
	label,
}: {
	mailboxId: string;
	label: Label;
}) {
	const [editing, setEditing] = useState(false);
	const [name, setName] = useState(label.name ?? "");
	const [color, setColor] = useState(label.color ?? DEFAULT_LABEL_COLOR);
	const updateMutation = useUpdateLabel(mailboxId);
	const deleteMutation = useDeleteLabel(mailboxId);

	const save = () => {
		const trimmed = name.trim();
		if (!trimmed || !label.id) {
			return;
		}
		updateMutation.mutate(
			{ id: label.id, body: { name: trimmed, color } },
			{ onSuccess: () => setEditing(false) },
		);
	};

	const remove = () => {
		if (!label.id) {
			return;
		}
		if (!window.confirm(`Delete label "${label.name}"?`)) {
			return;
		}
		deleteMutation.mutate(label.id);
	};

	if (editing) {
		return (
			<div className="space-y-2 rounded-md border p-3">
				<Input
					value={name}
					onChange={(event) => setName(event.target.value)}
					placeholder="Label name"
					autoFocus
				/>
				<ColorSwatches value={color} onChange={setColor} />
				<div className="flex gap-2">
					<Button size="sm" onClick={save} disabled={updateMutation.isPending || !name.trim()}>
						Save
					</Button>
					<Button
						size="sm"
						variant="outline"
						onClick={() => {
							setName(label.name ?? "");
							setColor(label.color ?? DEFAULT_LABEL_COLOR);
							setEditing(false);
						}}
					>
						Cancel
					</Button>
				</div>
				{updateMutation.isError ? (
					<p className="text-destructive text-xs">{getErrorMessage(updateMutation.error)}</p>
				) : null}
			</div>
		);
	}

	return (
		<div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50">
			<span
				className="size-3 shrink-0 rounded-full"
				style={{ backgroundColor: label.color ?? DEFAULT_LABEL_COLOR }}
			/>
			<span className="min-w-0 flex-1 truncate text-sm">{label.name}</span>
			<Button
				variant="ghost"
				size="icon"
				className="size-7"
				aria-label={`Edit ${label.name}`}
				onClick={() => setEditing(true)}
			>
				<Pencil className="size-3.5" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				className="text-destructive hover:text-destructive size-7"
				aria-label={`Delete ${label.name}`}
				disabled={deleteMutation.isPending}
				onClick={remove}
			>
				<Trash2 className="size-3.5" />
			</Button>
		</div>
	);
}

function AddLabelForm({ mailboxId }: { mailboxId: string }) {
	const [name, setName] = useState("");
	const [color, setColor] = useState<string>(DEFAULT_LABEL_COLOR);
	const createMutation = useCreateLabel(mailboxId);

	const submit = (event: React.FormEvent) => {
		event.preventDefault();
		const trimmed = name.trim();
		if (!trimmed) {
			return;
		}
		createMutation.mutate(
			{ name: trimmed, color },
			{
				onSuccess: () => {
					setName("");
					setColor(DEFAULT_LABEL_COLOR);
				},
			},
		);
	};

	return (
		<form onSubmit={submit} className="space-y-2 border-t pt-4">
			<p className="text-sm font-medium">Add label</p>
			<Input
				value={name}
				onChange={(event) => setName(event.target.value)}
				placeholder="New label name"
			/>
			<ColorSwatches value={color} onChange={setColor} />
			<Button type="submit" size="sm" disabled={createMutation.isPending || !name.trim()}>
				<Plus className="size-3.5" />
				Add label
			</Button>
			{createMutation.isError ? (
				<p className="text-destructive text-xs">{getErrorMessage(createMutation.error)}</p>
			) : null}
		</form>
	);
}

export function ManageLabelsDialog({
	mailboxId,
	open,
	onOpenChange,
}: ManageLabelsDialogProps) {
	const labelsQuery = useLabels(mailboxId);
	const labels = labelsQuery.data ?? [];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[min(32rem,90vh)] overflow-y-auto sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Manage labels</DialogTitle>
					<DialogDescription>
						Create, rename, recolor, or delete labels for this mailbox.
					</DialogDescription>
				</DialogHeader>
				{labelsQuery.isLoading ? (
					<p className="text-muted-foreground text-sm">Loading labels…</p>
				) : labelsQuery.isError ? (
					<p className="text-destructive text-sm">{getErrorMessage(labelsQuery.error)}</p>
				) : labels.length === 0 ? (
					<p className="text-muted-foreground text-sm">No labels yet.</p>
				) : (
					<div className="space-y-1">
						{labels.map((label) => (
							<LabelRow key={label.id} mailboxId={mailboxId} label={label} />
						))}
					</div>
				)}
				<AddLabelForm mailboxId={mailboxId} />
				<DialogFooter showCloseButton />
			</DialogContent>
		</Dialog>
	);
}
