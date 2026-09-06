import { Search, X } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import {
	formatOperatorSource,
	serializeDisplayTokens,
	splitSearchField,
	type SearchDisplayToken,
} from "@flaremail/mail-search-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MailSearchFieldProps = {
	value: string;
	onChange: (next: string) => void;
	onSubmit: () => void;
	onClear: () => void;
};

export function MailSearchField({
	value,
	onChange,
	onSubmit,
	onClear,
}: MailSearchFieldProps) {
	const { t } = useTranslation("mail");
	const inputRef = useRef<HTMLInputElement>(null);
	const model = splitSearchField(value);
	const tokens = model.valid ? model.tokens : [];
	const draft = model.valid ? model.draft : value;

	const setDraft = (nextDraft: string) => {
		if (!model.valid) {
			onChange(nextDraft);
			return;
		}
		onChange(serializeDisplayTokens(tokens, nextDraft));
	};

	const removeToken = (index: number) => {
		if (!model.valid) {
			return;
		}
		onChange(serializeDisplayTokens(tokens.filter((_, i) => i !== index), draft));
		inputRef.current?.focus();
	};

	const editToken = (index: number) => {
		if (!model.valid) {
			return;
		}
		const token = tokens[index];
		if (!token || token.type !== "op") {
			return;
		}
		const source = `${token.negated ? "-" : ""}${formatOperatorSource(token.name, token.value)}`;
		onChange(serializeDisplayTokens(tokens.filter((_, i) => i !== index), source));
		inputRef.current?.focus();
	};

	return (
		<div
			className={cn(
				"border-input bg-background focus-within:ring-primary flex min-w-0 items-center gap-1 rounded-md border px-2 py-1 shadow-sm focus-within:ring-1",
			)}
		>
			<Search className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
			<div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
				{tokens.map((token, index) => (
					<DisplayToken
						key={`${token.type}-${index}`}
						token={token}
						onEdit={() => editToken(index)}
						onRemove={() => removeToken(index)}
					/>
				))}
				<input
					ref={inputRef}
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							onSubmit();
						}
						if (
							event.key === "Backspace" &&
							draft === "" &&
							model.valid &&
							tokens.length > 0
						) {
							event.preventDefault();
							onChange(serializeDisplayTokens(tokens.slice(0, -1), ""));
						}
					}}
					onBlur={onSubmit}
					placeholder={tokens.length === 0 ? t("threadList.searchPlaceholder") : undefined}
					aria-label={t("threadList.searchAria")}
					className="placeholder:text-muted-foreground min-w-[6rem] flex-1 bg-transparent py-0.5 text-sm outline-none"
				/>
			</div>
			{value.trim() ? (
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="size-6 shrink-0"
					aria-label={t("threadList.clearSearch")}
					onClick={onClear}
				>
					<X className="size-3.5" />
				</Button>
			) : null}
		</div>
	);
}

function DisplayToken({
	token,
	onEdit,
	onRemove,
}: {
	token: SearchDisplayToken;
	onEdit: () => void;
	onRemove: () => void;
}) {
	if (token.type === "op") {
		return (
			<Badge
				variant="secondary"
				className="h-6 gap-1 px-1.5 py-0 font-normal"
			>
				<button
					type="button"
					className="max-w-[10rem] truncate"
					onClick={onEdit}
				>
					{token.negated ? "-" : ""}
					{token.name}:{token.value}
				</button>
				<button
					type="button"
					className="text-muted-foreground hover:text-foreground"
					aria-label={`${token.name}:${token.value}`}
					onClick={onRemove}
				>
					<X className="size-3" />
				</button>
			</Badge>
		);
	}

	const glue =
		token.type === "and"
			? "&&"
			: token.type === "or"
				? "||"
				: token.type === "not"
					? "-"
					: token.type === "lparen"
						? "("
						: token.type === "rparen"
							? ")"
							: token.value;

	return <span className="text-muted-foreground px-0.5 text-xs">{glue}</span>;
}
