import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { LegacyCombobox } from "@/components/ui/legacy-combobox";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@/components/ui/input-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useDomains } from "@/hooks/use-domains";
import { useCreateMailbox, useMailboxes } from "@/hooks/use-mailboxes";
import type { CreateMailboxRequest, Mailbox } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import {
	filterDomainsForAccount,
	soleAccessibleDomainId,
} from "@/lib/accounts/domains";
import { useAuth } from "@/lib/auth/AuthProvider";
import { buildDomainNamesById, sortMailboxes } from "@/lib/sort-mailboxes";

const MAILBOX_TYPE_VALUES: CreateMailboxRequest["type"][] = ["shared", "alias"];

const emptyForm = {
	localPart: "",
	domainId: "",
	type: "shared" as CreateMailboxRequest["type"],
	aliasTarget: "",
};

function sanitizeLocalPart(value: string): string {
	return value.replace(/@/g, "");
}

function isValidEmailAddress(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

type ResolvedAliasTarget =
	| { kind: "internal"; aliasTargetId: string }
	| { kind: "external"; aliasTargetAddress: string }
	| { kind: "invalid" };

function resolveAliasTarget(
	input: string,
	receivingMailboxes: Mailbox[],
): ResolvedAliasTarget {
	const trimmed = input.trim();
	if (!trimmed) {
		return { kind: "invalid" };
	}

	const normalized = trimmed.toLowerCase();
	const byId = receivingMailboxes.find((mailbox) => mailbox.id === trimmed);
	if (byId?.id) {
		return { kind: "internal", aliasTargetId: byId.id };
	}

	const byAddress = receivingMailboxes.find(
		(mailbox) => mailbox.address?.toLowerCase() === normalized,
	);
	if (byAddress?.id) {
		return { kind: "internal", aliasTargetId: byAddress.id };
	}

	if (isValidEmailAddress(trimmed)) {
		return { kind: "external", aliasTargetAddress: trimmed };
	}

	return { kind: "invalid" };
}

type AddMailboxDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

export function AddMailboxDialog({ open, onOpenChange }: AddMailboxDialogProps) {
	const { t } = useTranslation("management");
	const { t: tc } = useTranslation("common");
	const { account } = useAuth();
	const domainsQuery = useDomains();
	const mailboxesQuery = useMailboxes("manage");
	const createMailbox = useCreateMailbox();
	const [form, setForm] = useState(emptyForm);

	const mailboxTypes = useMemo(
		() =>
			MAILBOX_TYPE_VALUES.map((value) => ({
				value,
				label:
					value === "shared"
						? t("mailboxes.types.shared.label")
						: t("mailboxes.types.alias.label"),
				description:
					value === "shared"
						? t("mailboxes.types.shared.description")
						: t("mailboxes.types.alias.description"),
			})),
		[t],
	);

	const domains = useMemo(
		() => filterDomainsForAccount(account, domainsQuery.data ?? []),
		[account, domainsQuery.data],
	);

	useEffect(() => {
		if (!open) {
			return;
		}
		const soleDomainId = soleAccessibleDomainId(domains);
		if (!soleDomainId) {
			return;
		}
		setForm((current) =>
			current.domainId ? current : { ...current, domainId: soleDomainId },
		);
	}, [domains, open]);

	const mailboxes = mailboxesQuery.data ?? [];
	const domainNamesById = useMemo(
		() => buildDomainNamesById(domains, mailboxes),
		[domains, mailboxes],
	);
	const receivingMailboxes = useMemo(
		() =>
			sortMailboxes(
				mailboxes.filter((mailbox) => mailbox.type !== "alias"),
				domainNamesById,
			),
		[mailboxes, domainNamesById],
	);

	const aliasTargetOptions = receivingMailboxes.flatMap((mailbox) =>
		mailbox.id && mailbox.address
			? [{ value: mailbox.id, label: mailbox.address }]
			: [],
	);

	const resolvedAliasTarget = useMemo(
		() =>
			form.type === "alias"
				? resolveAliasTarget(form.aliasTarget, receivingMailboxes)
				: null,
		[form.type, form.aliasTarget, receivingMailboxes],
	);

	const selectedType = mailboxTypes.find((item) => item.value === form.type);

	const missingRequirement =
		domains.length === 0
			? t("mailboxes.addDialog.req.addDomain")
			: !form.domainId
				? t("mailboxes.addDialog.req.selectDomain")
				: !form.localPart.trim()
					? t("mailboxes.addDialog.req.enterAddress")
					: form.type === "alias" && resolvedAliasTarget?.kind === "invalid"
						? t("mailboxes.addDialog.req.validAlias")
						: null;

	const canSubmit = !missingRequirement;

	const handleOpenChange = (next: boolean) => {
		onOpenChange(next);
		if (!next) {
			setForm(emptyForm);
			createMailbox.reset();
		}
	};

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

		if (form.type === "alias" && resolvedAliasTarget) {
			if (resolvedAliasTarget.kind === "internal") {
				body.aliasTargetId = resolvedAliasTarget.aliasTargetId;
			} else if (resolvedAliasTarget.kind === "external") {
				body.aliasTargetAddress = resolvedAliasTarget.aliasTargetAddress;
			} else {
				return;
			}
		}

		createMailbox.mutate(body, {
			onSuccess: () => handleOpenChange(false),
		});
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{t("mailboxes.addDialog.title")}</DialogTitle>
					<DialogDescription>{t("mailboxes.addDialog.description")}</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleCreate} className="space-y-4">
					<div className="space-y-1">
						<label className="text-sm font-medium" htmlFor="mailbox-local-part">
							{t("mailboxes.addDialog.address")}
						</label>
						<InputGroup>
							<InputGroupInput
								id="mailbox-local-part"
								placeholder={t("mailboxes.addDialog.localPartPlaceholder")}
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
										aria-label={t("mailboxes.addDialog.domainAria")}
										className="h-8 max-w-40 gap-1 border-0 bg-transparent px-1 shadow-none focus:ring-0"
									>
										<SelectValue placeholder={t("mailboxes.addDialog.domainPlaceholder")} />
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
							{t("mailboxes.addDialog.type")}
						</label>
						<Select
							value={form.type}
							onValueChange={(type) =>
								setForm((current) => ({
									...current,
									type: type as CreateMailboxRequest["type"],
									aliasTarget: "",
								}))
							}
							disabled={createMailbox.isPending}
						>
							<SelectTrigger id="mailbox-type">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{mailboxTypes.map((type) => (
									<SelectItem key={type.value} value={type.value}>
										{type.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{selectedType ? (
							<p className="text-muted-foreground text-xs">
								{selectedType.description}
							</p>
						) : null}
					</div>

					{form.type === "alias" ? (
						<div className="space-y-1">
							<label className="text-sm font-medium" htmlFor="alias-target">
								{t("mailboxes.addDialog.aliasTarget")}
							</label>
							<LegacyCombobox
								id="alias-target"
								value={form.aliasTarget}
								onValueChange={(aliasTarget) =>
									setForm((current) => ({ ...current, aliasTarget }))
								}
								options={aliasTargetOptions}
								allowCustom
								placeholder={t("mailboxes.addDialog.aliasPlaceholder")}
								searchPlaceholder={t("mailboxes.addDialog.aliasSearchPlaceholder")}
								emptyText={t("mailboxes.addDialog.aliasEmpty")}
								disabled={createMailbox.isPending}
							/>
							{resolvedAliasTarget?.kind === "external" ? (
								<p className="text-muted-foreground text-xs">
									{t("mailboxes.addDialog.externalForwardHint")}
								</p>
							) : null}
						</div>
					) : null}

					{createMailbox.isError ? (
						<Alert tone="destructive" title={t("mailboxes.addDialog.createErrorTitle")}>
							<p>{getErrorMessage(createMailbox.error)}</p>
						</Alert>
					) : null}

					<DialogFooter className="items-center sm:justify-between">
						<p className="text-muted-foreground text-xs">
							{!createMailbox.isPending ? missingRequirement : null}
						</p>
						<div className="flex gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => handleOpenChange(false)}
							>
								{tc("cancel")}
							</Button>
							<Button
								type="submit"
								disabled={createMailbox.isPending || !canSubmit}
							>
								{createMailbox.isPending
									? t("mailboxes.addDialog.creating")
									: t("mailboxes.add")}
							</Button>
						</div>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
