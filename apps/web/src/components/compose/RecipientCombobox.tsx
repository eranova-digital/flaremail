import * as React from "react";

import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxList,
	ComboboxValue,
	useComboboxAnchor,
} from "@/components/ui/combobox";
import { formatRecipients, parseRecipients } from "@/hooks/compose/types";

type RecipientComboboxProps = {
	id?: string;
	value: string;
	onValueChange: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
	suggestions?: string[];
	onEmptyBlur?: () => void;
};

export function RecipientCombobox({
	id,
	value,
	onValueChange,
	placeholder = "recipient@example.com",
	disabled = false,
	suggestions = [],
	onEmptyBlur,
}: RecipientComboboxProps) {
	const anchor = useComboboxAnchor();
	const valueRef = React.useRef(value);
	const queryRef = React.useRef("");
	const selected = React.useMemo(
		() => parseRecipients(value) as string[],
		[value],
	);
	const [query, setQuery] = React.useState("");

	valueRef.current = value;
	queryRef.current = query;

	const isEmpty = React.useCallback(() => {
		const recipients = parseRecipients(valueRef.current) as string[];
		return recipients.length === 0 && queryRef.current.trim() === "";
	}, []);

	const notifyEmptyBlur = React.useCallback(() => {
		if (!onEmptyBlur) {
			return;
		}

		window.setTimeout(() => {
			if (isEmpty()) {
				onEmptyBlur();
			}
		}, 0);
	}, [isEmpty, onEmptyBlur]);

	// Commits whatever the user has typed but not yet turned into a chip. Without
	// this, leaving the field (Tab, click away, or Send) discards the pending
	// recipient. Tab is handled on keydown (reading the live input value) because
	// the combobox often clears controlled input state before blur.
	const commitPendingQuery = React.useCallback(
		(pendingOverride?: string) => {
			const pending = (pendingOverride ?? queryRef.current).trim();
			if (!pending) {
				return;
			}

			const current = parseRecipients(valueRef.current) as string[];
			const additions = parseRecipients(pending) as string[];
			const merged = [...current];
			for (const addition of additions) {
				if (!merged.includes(addition)) {
					merged.push(addition);
				}
			}

			const formatted = formatRecipients(merged);
			valueRef.current = formatted;
			queryRef.current = "";
			onValueChange(formatted);
			setQuery("");
		},
		[onValueChange],
	);

	const handleInputBlur = React.useCallback(
		(event: React.FocusEvent<HTMLInputElement>) => {
			commitPendingQuery(event.currentTarget.value);
			notifyEmptyBlur();
		},
		[commitPendingQuery, notifyEmptyBlur],
	);

	const handleInputKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>) => {
			if (event.key === "Tab") {
				commitPendingQuery(event.currentTarget.value);
			}
		},
		[commitPendingQuery],
	);

	const items = React.useMemo(() => {
		const known = new Set([...selected, ...suggestions]);
		const trimmed = query.trim();
		const lowered = trimmed.toLowerCase();
		const matches = [...known].filter(
			(item) => !trimmed || item.toLowerCase().includes(lowered),
		);
		const exactExists = [...known].some(
			(item) => item.toLowerCase() === lowered,
		);

		if (trimmed && !exactExists) {
			return [...matches, trimmed];
		}

		return matches;
	}, [query, selected, suggestions]);

	return (
		<Combobox
			multiple
			autoHighlight
			items={items}
			value={selected}
			onValueChange={(next) => {
				const formatted = formatRecipients(next as string[]);
				valueRef.current = formatted;
				queryRef.current = "";
				onValueChange(formatted);
				setQuery("");
			}}
			inputValue={query}
			onInputValueChange={(nextQuery) => {
				queryRef.current = nextQuery;
				setQuery(nextQuery);
			}}
			disabled={disabled}
			onOpenChange={(open) => {
				if (!open) {
					commitPendingQuery();
					notifyEmptyBlur();
				}
			}}
		>
			<ComboboxChips ref={anchor} id={id} className="w-full">
				<ComboboxValue>
					{(values: string[]) => (
						<>
							{values.map((email: string) => (
								<ComboboxChip key={email}>{email}</ComboboxChip>
							))}
							<ComboboxChipsInput
								placeholder={values.length === 0 ? placeholder : undefined}
								onBlur={handleInputBlur}
								onKeyDown={handleInputKeyDown}
							/>
						</>
					)}
				</ComboboxValue>
			</ComboboxChips>
			<ComboboxContent anchor={anchor}>
				<ComboboxEmpty>Type an email address</ComboboxEmpty>
				<ComboboxList>
					{(item) => (
						<ComboboxItem key={item} value={item}>
							{item}
						</ComboboxItem>
					)}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	);
}
