import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

export function useMailSearchParam() {
	const [searchParams, setSearchParams] = useSearchParams();
	const q = searchParams.get("q") ?? "";
	const [draft, setDraft] = useState(q);

	useEffect(() => {
		setDraft(q);
	}, [q]);

	useEffect(() => {
		if (draft === q) {
			return;
		}
		const timer = window.setTimeout(() => {
			setSearchParams(
				(previous) => {
					const next = new URLSearchParams(previous);
					const trimmed = draft.trim();
					if (trimmed) {
						next.set("q", draft);
					} else {
						next.delete("q");
					}
					return next;
				},
				{ replace: true },
			);
		}, 300);
		return () => window.clearTimeout(timer);
	}, [draft, q, setSearchParams]);

	const flush = () => {
		setSearchParams(
			(previous) => {
				const next = new URLSearchParams(previous);
				const trimmed = draft.trim();
				if (trimmed) {
					next.set("q", draft);
				} else {
					next.delete("q");
				}
				return next;
			},
			{ replace: true },
		);
	};

	const clear = () => {
		setDraft("");
		setSearchParams(
			(previous) => {
				const next = new URLSearchParams(previous);
				next.delete("q");
				return next;
			},
			{ replace: true },
		);
	};

	return { draft, setDraft, q, flush, clear };
}
