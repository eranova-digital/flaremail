import { useState } from "react";
import { Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDomains } from "@/hooks/use-domains";
import {
	useCreateMailbox,
	useDeleteMailbox,
	useMailboxes,
	useUpdateMailbox,
} from "@/hooks/use-mailboxes";
import type { CreateMailboxRequest, Mailbox } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";

const MAILBOX_TYPES: CreateMailboxRequest["type"][] = [
	"primary",
	"secondary",
	"shared",
	"alias",
];

const emptyForm = {
	localPart: "",
	domainId: "",
	type: "primary" as CreateMailboxRequest["type"],
	aliasTargetKind: "internal" as "internal" | "external",
	aliasTargetId: "",
	aliasTargetAddress: "",
};

function sanitizeLocalPart(value: string): string {
	return value.replace(/@/g, "");
}

export function MailboxSection() {
	const mailboxesQuery = useMailboxes();
	const domainsQuery = useDomains();
	const createMailbox = useCreateMailbox();
	const [form, setForm] = useState(emptyForm);

	const domains = domainsQuery.data ?? [];
	const receivingMailboxes = (mailboxesQuery.data ?? []).filter(
		(mailbox) => mailbox.type !== "alias",
	);

	const handleCreate = (event: React.FormEvent) => {
		event.preventDefault();

		const selectedDomain = domains.find((domain) => domain.id === form.domainId);
		if (!selectedDomain?.domain) {
			return;
		}

		const localPart = form.localPart.trim();
		const body: CreateMailboxRequest = {
			address: `${localPart}@${selectedDomain.domain}`,
			domainId: form.domainId,
			type: form.type,
		};

		if (form.type === "alias") {
			if (form.aliasTargetKind === "internal") {
				body.aliasTargetId = form.aliasTargetId;
			} else {
				body.aliasTargetAddress = form.aliasTargetAddress.trim();
			}
		}

		createMailbox.mutate(body, {
			onSuccess: () => setForm(emptyForm),
		});
	};

	const canSubmit =
		form.localPart.trim() &&
		form.domainId &&
		(form.type !== "alias" ||
			(form.aliasTargetKind === "internal"
				? Boolean(form.aliasTargetId)
				: Boolean(form.aliasTargetAddress.trim())));

	const aliasTargetOptions = receivingMailboxes.flatMap((mailbox) =>
		mailbox.id && mailbox.address
			? [{ value: mailbox.id, label: mailbox.address }]
			: [],
	);

	return (
		<section className="space-y-4">
			<div>
				<h2 className="text-lg font-medium">Mailboxes</h2>
				<p className="text-muted-foreground text-sm">
					Create and manage email addresses on your domains.
				</p>
			</div>

			<form onSubmit={handleCreate} className="space-y-3 rounded-md border p-4">
				<div className="grid gap-3 sm:grid-cols-2">
					<div className="space-y-1 sm:col-span-2">
						<label className="text-sm font-medium" htmlFor="mailbox-local-part">
							Address
						</label>
						<InputGroup>
							<InputGroupInput
								id="mailbox-local-part"
								placeholder="patrick"
								value={form.localPart}
								onChange={(event) =>
									setForm((current) => ({
										...current,
										localPart: sanitizeLocalPart(event.target.value),
									}))
								}
								disabled={createMailbox.isPending || domains.length === 0}
								autoComplete="off"
								spellCheck={false}
							/>
							<InputGroupAddon align="inline-end">
								<InputGroupText>@</InputGroupText>
								<Select
									value={form.domainId || undefined}
									onValueChange={(domainId) =>
										setForm((current) => ({ ...current, domainId }))
									}
									disabled={createMailbox.isPending || domains.length === 0}
								>
									<SelectTrigger
										id="mailbox-domain"
										aria-label="Domain"
										className="h-8 max-w-40 gap-1 border-0 bg-transparent px-1 shadow-none focus:ring-0"
									>
										<SelectValue placeholder="domain…" />
									</SelectTrigger>
									<SelectContent>
										{domains.map((domain) =>
											domain.id ? (
												<SelectItem key={domain.id} value={domain.id}>
													{domain.domain}
												</SelectItem>
											) : null,
										)}
									</SelectContent>
								</Select>
							</InputGroupAddon>
						</InputGroup>
					</div>

					<div className="space-y-1">
						<label className="text-sm font-medium" htmlFor="mailbox-type">
							Type
						</label>
						<Select
							value={form.type}
							onValueChange={(type) =>
								setForm((current) => ({
									...current,
									type: type as CreateMailboxRequest["type"],
									aliasTargetKind: "internal",
									aliasTargetId: "",
									aliasTargetAddress: "",
								}))
							}
							disabled={createMailbox.isPending}
						>
							<SelectTrigger id="mailbox-type">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{MAILBOX_TYPES.map((type) => (
									<SelectItem key={type} value={type}>
										{type}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{form.type === "alias" ? (
						<>
							<div className="space-y-1">
								<label className="text-sm font-medium" htmlFor="alias-target-kind">
									Alias target type
								</label>
								<Select
									value={form.aliasTargetKind}
									onValueChange={(aliasTargetKind) =>
										setForm((current) => ({
											...current,
											aliasTargetKind: aliasTargetKind as "internal" | "external",
											aliasTargetId: "",
											aliasTargetAddress: "",
										}))
									}
									disabled={createMailbox.isPending}
								>
									<SelectTrigger id="alias-target-kind">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="internal">Internal mailbox</SelectItem>
										<SelectItem value="external">External address</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-1 sm:col-span-2">
								<label className="text-sm font-medium" htmlFor="alias-target">
									Alias target
								</label>
								{form.aliasTargetKind === "internal" ? (
									<Combobox
										id="alias-target"
										value={form.aliasTargetId}
										onValueChange={(aliasTargetId) =>
											setForm((current) => ({ ...current, aliasTargetId }))
										}
										options={aliasTargetOptions}
										placeholder="Select target mailbox…"
										searchPlaceholder="Search mailboxes…"
										emptyText="No mailboxes found."
										disabled={createMailbox.isPending}
									/>
								) : (
									<Input
										id="alias-target"
										type="email"
										placeholder="patrick@gmail.com"
										value={form.aliasTargetAddress}
										onChange={(event) =>
											setForm((current) => ({
												...current,
												aliasTargetAddress: event.target.value,
											}))
										}
										disabled={createMailbox.isPending}
										autoComplete="off"
										spellCheck={false}
									/>
								)}
								{form.aliasTargetKind === "external" ? (
									<p className="text-muted-foreground text-xs">
										Mail to this alias is forwarded externally and not stored.
									</p>
								) : null}
							</div>
						</>
					) : null}
				</div>

				<Button
					type="submit"
					disabled={createMailbox.isPending || !canSubmit || domains.length === 0}
				>
					Add mailbox
				</Button>

				{domains.length === 0 ? (
					<p className="text-muted-foreground text-sm">Add a domain first.</p>
				) : null}
			</form>

			{createMailbox.isError ? (
				<p className="text-destructive text-sm">{getErrorMessage(createMailbox.error)}</p>
			) : null}

			{mailboxesQuery.isLoading ? (
				<div className="space-y-2">
					{Array.from({ length: 3 }).map((_, index) => (
						<Skeleton key={index} className="h-14 w-full" />
					))}
				</div>
			) : mailboxesQuery.isError ? (
				<p className="text-destructive text-sm">{getErrorMessage(mailboxesQuery.error)}</p>
			) : (mailboxesQuery.data ?? []).length === 0 ? (
				<p className="text-muted-foreground text-sm">No mailboxes yet. Add one above.</p>
			) : (
				<ul className="divide-border divide-y rounded-md border">
					{(mailboxesQuery.data ?? []).map((mailbox) => (
						<MailboxRow
							key={mailbox.id}
							mailbox={mailbox}
							domainName={
								domains.find((domain) => domain.id === mailbox.domainId)?.domain
							}
							aliasTargetLabel={
								mailbox.aliasTargetAddress ??
								mailboxesQuery.data?.find(
									(item) => item.id === mailbox.aliasTargetId,
								)?.address
							}
						/>
					))}
				</ul>
			)}
		</section>
	);
}

function MailboxRow({
	mailbox,
	domainName,
	aliasTargetLabel,
}: {
	mailbox: Mailbox;
	domainName?: string;
	aliasTargetLabel?: string;
}) {
	const updateMailbox = useUpdateMailbox();
	const deleteMailbox = useDeleteMailbox();

	if (!mailbox.id) {
		return null;
	}

	const handleToggleActive = () => {
		updateMailbox.mutate({
			id: mailbox.id!,
			body: { isActive: !mailbox.isActive },
		});
	};

	const handleDelete = () => {
		const confirmed = window.confirm(
			`Delete mailbox "${mailbox.address}"? This permanently removes all messages in this mailbox.`,
		);
		if (!confirmed) {
			return;
		}
		deleteMailbox.mutate(mailbox.id!);
	};

	const isPending = updateMailbox.isPending || deleteMailbox.isPending;
	const mutationError = updateMailbox.error ?? deleteMailbox.error;

	return (
		<li className="space-y-2 p-4">
			<div className="flex items-center justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<p className="truncate font-medium">{mailbox.address}</p>
					<div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
						{domainName ? <span>{domainName}</span> : null}
						{mailbox.type ? (
							<Badge variant="outline" className="text-xs">
								{mailbox.type}
							</Badge>
						) : null}
						{mailbox.type === "alias" && aliasTargetLabel ? (
							<span>→ {aliasTargetLabel}</span>
						) : null}
						<Badge variant={mailbox.isActive ? "default" : "secondary"}>
							{mailbox.isActive ? "Active" : "Inactive"}
						</Badge>
					</div>
				</div>

				<div className="flex shrink-0 items-center gap-2">
					<label className="flex items-center gap-1.5 text-sm">
						<input
							type="checkbox"
							checked={mailbox.isActive ?? false}
							onChange={handleToggleActive}
							disabled={isPending}
							className="size-4 rounded border"
						/>
						<span className="sr-only sm:not-sr-only">Active</span>
					</label>
					<Button
						variant="ghost"
						size="icon"
						onClick={handleDelete}
						disabled={isPending}
						aria-label={`Delete ${mailbox.address}`}
					>
						<Trash2 className="text-destructive size-4" />
					</Button>
				</div>
			</div>

			{mutationError ? (
				<p className="text-destructive text-sm">{getErrorMessage(mutationError)}</p>
			) : null}
		</li>
	);
}
