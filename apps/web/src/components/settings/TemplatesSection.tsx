import { useMemo, useRef, useState } from "react";
import { FileCode2, Globe, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	useCreateEmailTemplate,
	useDeleteEmailTemplate,
	useManageableTemplates,
} from "@/hooks/use-email-templates";
import { useMailboxes } from "@/hooks/use-mailboxes";
import {
	canCreateGlobalTemplates,
} from "@/lib/accounts/permissions";
import { getErrorMessage } from "@/lib/api/errors";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { EmailTemplate } from "@/lib/email-templates/api";
import { useCanAccessOrganizationTab } from "@/hooks/use-instance-settings";
import { SystemTemplatesSection } from "@/components/settings/SystemTemplatesSection";
import { ComposeTemplatePreviewButton } from "@/components/email-templates/TemplatePreviewButton";
import { ComposeTemplateDownloadButton } from "@/components/email-templates/TemplateDownloadButton";

const GLOBAL_SCOPE = "__global__";

export function TemplatesSection() {
	const { t } = useTranslation("management");
	const { t: tc } = useTranslation("common");
	const { account } = useAuth();
	const canCreateGlobal = canCreateGlobalTemplates(account);
	const organizationAccess = useCanAccessOrganizationTab(account);
	const showSystemTemplates = organizationAccess.canAccess;
	const templatesQuery = useManageableTemplates();
	const mailboxesQuery = useMailboxes("manage");
	const createMutation = useCreateEmailTemplate();
	const deleteMutation = useDeleteEmailTemplate();

	const [addOpen, setAddOpen] = useState(false);
	const [name, setName] = useState("");
	const [scopeValue, setScopeValue] = useState(
		canCreateGlobal ? GLOBAL_SCOPE : "",
	);
	const [file, setFile] = useState<File | null>(null);
	const [formError, setFormError] = useState<string | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const items = templatesQuery.data?.items ?? [];
	const mailboxes = mailboxesQuery.data ?? [];

	const sorted = useMemo(() => {
		const global = items.filter((item) => item.scope === "global");
		const mailbox = items.filter((item) => item.scope === "mailbox");
		return { global, mailbox };
	}, [items]);

	const resetForm = () => {
		setName("");
		setScopeValue(canCreateGlobal ? GLOBAL_SCOPE : "");
		setFile(null);
		setFormError(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	const openAdd = () => {
		resetForm();
		setAddOpen(true);
	};

	const submitCreate = async () => {
		setFormError(null);
		if (!name.trim()) {
			setFormError(t("templates.validation.nameRequired"));
			return;
		}
		if (!file) {
			setFormError(t("templates.validation.fileRequired"));
			return;
		}
		if (!scopeValue) {
			setFormError(t("templates.validation.scopeRequired"));
			return;
		}

		try {
			await createMutation.mutateAsync({
				name: name.trim(),
				mailboxId: scopeValue === GLOBAL_SCOPE ? null : scopeValue,
				file,
			});
			setAddOpen(false);
			resetForm();
		} catch (error) {
			setFormError(getErrorMessage(error));
		}
	};

	return (
		<section className="space-y-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 className="text-lg font-medium">{t("templates.title")}</h2>
					<p className="text-muted-foreground text-sm">
						{t("templates.description")}
					</p>
				</div>
				<Button onClick={openAdd}>
					<Plus className="size-4" aria-hidden />
					{t("templates.add")}
				</Button>
			</div>

			{templatesQuery.isLoading ? (
				<div className="space-y-2">
					{Array.from({ length: 3 }).map((_, index) => (
						<Skeleton key={index} className="h-14 w-full rounded-lg" />
					))}
				</div>
			) : templatesQuery.isError ? (
				<Alert tone="destructive" title={t("templates.loadErrorTitle")}>
					<p>{getErrorMessage(templatesQuery.error)}</p>
				</Alert>
			) : items.length === 0 ? (
				<p className="text-muted-foreground text-sm">{t("templates.empty")}</p>
			) : (
				<div className="space-y-6">
					{sorted.global.length > 0 ? (
						<div className="space-y-2">
							<h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
								{t("templates.scope.global")}
							</h3>
							<ul className="divide-border border-border divide-y rounded-lg border">
								{sorted.global.map((template) => (
									<TemplateRow
										key={template.id}
										template={template}
										onDelete={() => setDeleteTarget(template)}
										deleting={
											deleteMutation.isPending &&
											deleteTarget?.id === template.id
										}
									/>
								))}
							</ul>
						</div>
					) : null}
					{sorted.mailbox.length > 0 ? (
						<div className="space-y-2">
							<h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
								{t("templates.scope.mailbox")}
							</h3>
							<ul className="divide-border border-border divide-y rounded-lg border">
								{sorted.mailbox.map((template) => (
									<TemplateRow
										key={template.id}
										template={template}
										onDelete={() => setDeleteTarget(template)}
										deleting={
											deleteMutation.isPending &&
											deleteTarget?.id === template.id
										}
									/>
								))}
							</ul>
						</div>
					) : null}
				</div>
			)}

			<Dialog
				open={addOpen}
				onOpenChange={(open) => {
					setAddOpen(open);
					if (!open) {
						resetForm();
					}
				}}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>{t("templates.addDialog.title")}</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<label className="block space-y-1.5">
							<span className="text-sm font-medium">{tc("name")}</span>
							<Input
								value={name}
								onChange={(event) => setName(event.target.value)}
								placeholder={t("templates.addDialog.namePlaceholder")}
								autoFocus
							/>
						</label>
						<label className="block space-y-1.5">
							<span className="text-sm font-medium">{t("templates.addDialog.scope")}</span>
							<Select value={scopeValue} onValueChange={setScopeValue}>
								<SelectTrigger>
									<SelectValue placeholder={t("templates.addDialog.scopePlaceholder")} />
								</SelectTrigger>
								<SelectContent>
									{canCreateGlobal ? (
										<SelectItem value={GLOBAL_SCOPE}>
											{t("templates.scope.global")}
										</SelectItem>
									) : null}
									{mailboxes
										.filter(
											(mailbox): mailbox is typeof mailbox & { id: string } =>
												typeof mailbox.id === "string",
										)
										.map((mailbox) => (
											<SelectItem key={mailbox.id} value={mailbox.id}>
												{mailbox.address ?? mailbox.id}
											</SelectItem>
										))}
								</SelectContent>
							</Select>
						</label>
						<label className="block space-y-1.5">
							<span className="text-sm font-medium">{t("templates.addDialog.htmlFile")}</span>
							<input
								ref={fileInputRef}
								type="file"
								accept=".html,.htm,text/html"
								className="border-input bg-background block w-full rounded-md border px-3 py-2 text-sm"
								onChange={(event) => {
									setFile(event.target.files?.[0] ?? null);
								}}
							/>
						</label>
						{formError ? (
							<Alert tone="destructive" title={t("templates.loadErrorTitle")}>
								<p>{formError}</p>
							</Alert>
						) : null}
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setAddOpen(false)}
							disabled={createMutation.isPending}
						>
							{tc("cancel")}
						</Button>
						<Button
							onClick={() => void submitCreate()}
							disabled={createMutation.isPending}
						>
							{createMutation.isPending
								? t("templates.addDialog.uploading")
								: tc("upload")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<ConfirmDialog
				open={deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open) {
						setDeleteTarget(null);
					}
				}}
				title={t("templates.deleteConfirm.title")}
				description={
					deleteTarget
						? t("templates.deleteConfirm.description", { name: deleteTarget.name })
						: ""
				}
				confirmLabel={tc("delete")}
				pending={deleteMutation.isPending}
				onConfirm={() => {
					if (!deleteTarget) {
						return;
					}
					void deleteMutation.mutateAsync(deleteTarget.id).then(() => {
						setDeleteTarget(null);
					});
				}}
			/>

			{showSystemTemplates ? <SystemTemplatesSection /> : null}
		</section>
	);
}

function TemplateRow({
	template,
	onDelete,
	deleting,
}: {
	template: EmailTemplate;
	onDelete: () => void;
	deleting: boolean;
}) {
	const { t } = useTranslation("management");

	return (
		<li className="flex items-center justify-between gap-3 px-3 py-2.5">
			<div className="flex min-w-0 items-center gap-2.5">
				{template.scope === "global" ? (
					<Globe className="text-muted-foreground size-4 shrink-0" aria-hidden />
				) : (
					<FileCode2
						className="text-muted-foreground size-4 shrink-0"
						aria-hidden
					/>
				)}
				<div className="min-w-0">
					<p className="truncate text-sm font-medium">{template.name}</p>
					{template.mailboxAddress ? (
						<p className="text-muted-foreground truncate text-xs">
							{template.mailboxAddress}
						</p>
					) : (
						<Badge variant="secondary" className="mt-0.5">
							{t("templates.scope.global")}
						</Badge>
					)}
				</div>
			</div>
			<div className="flex shrink-0 items-center gap-1">
				<ComposeTemplatePreviewButton templateId={template.id} />
				<ComposeTemplateDownloadButton
					templateId={template.id}
					templateName={template.name}
				/>
				<Button
					type="button"
					variant="ghost"
					size="icon-xs"
					aria-label={t("templates.deleteAria", { name: template.name })}
					disabled={deleting}
					onClick={onDelete}
				>
					<Trash2 className="size-4" />
				</Button>
			</div>
		</li>
	);
}
