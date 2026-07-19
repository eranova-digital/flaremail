import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ComposeEditor } from "@/components/compose/ComposeEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	IDENTITY_NAME_PATTERN_OPTIONS,
	type Identity,
	type IdentityInput,
} from "@/lib/identities/api";
import type { IdentityNamePattern } from "@test-worker/identity-name-pattern";

type IdentityFormProps = {
	initial?: Identity;
	allowCustom: boolean;
	busy: boolean;
	onSubmit: (input: IdentityInput) => void;
	onCancel: () => void;
};

export function IdentityForm({
	initial,
	allowCustom,
	busy,
	onSubmit,
	onCancel,
}: IdentityFormProps) {
	const { t } = useTranslation("settings");
	const { t: tc } = useTranslation("common");
	const [namePattern, setNamePattern] = useState<IdentityNamePattern>(
		initial?.namePattern ?? "first_name_last_name",
	);
	const [customName, setCustomName] = useState(initial?.customName ?? "");
	const [signatureHtml, setSignatureHtml] = useState(
		initial?.signatureHtml ?? "",
	);

	const patternOptions = IDENTITY_NAME_PATTERN_OPTIONS.filter(
		(option) => allowCustom || option.value !== "custom",
	);

	return (
		<div className="space-y-3 rounded-lg border p-4">
			<div className="space-y-2">
				<label htmlFor="identity-name-pattern" className="text-sm font-medium">
					{t("identities.form.namePattern")}
				</label>
				<Select
					value={namePattern}
					onValueChange={(value) =>
						setNamePattern(value as IdentityNamePattern)
					}
					disabled={busy}
				>
					<SelectTrigger id="identity-name-pattern">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{patternOptions.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{t(`identities.patterns.${option.value}`)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			{namePattern === "custom" ? (
				<div className="space-y-2">
					<label htmlFor="identity-custom-name" className="text-sm font-medium">
						{t("identities.form.customName")}
					</label>
					<Input
						id="identity-custom-name"
						value={customName}
						disabled={busy}
						onChange={(event) => setCustomName(event.target.value)}
					/>
				</div>
			) : null}
			<div className="space-y-2">
				<label className="text-sm font-medium">
					{t("identities.form.signature")}
				</label>
				<ComposeEditor
					key={initial?.id ?? "new"}
					initialHtml={signatureHtml || "<p></p>"}
					placeholder={t("identities.form.signaturePlaceholder")}
					disabled={busy}
					className="min-h-[140px]"
					onChange={({ html }) => setSignatureHtml(html)}
				/>
				<p className="text-muted-foreground text-xs">
					{t("identities.form.tagsHelp")}
				</p>
			</div>
			<div className="flex gap-2">
				<Button
					disabled={busy || (namePattern === "custom" && !customName.trim())}
					onClick={() =>
						onSubmit({
							namePattern,
							customName: namePattern === "custom" ? customName : null,
							signatureHtml:
								signatureHtml.trim() && signatureHtml !== "<p></p>"
									? signatureHtml
									: null,
						})
					}
				>
					{busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
					{tc("save")}
				</Button>
				<Button variant="outline" disabled={busy} onClick={onCancel}>
					{tc("cancel")}
				</Button>
			</div>
		</div>
	);
}
