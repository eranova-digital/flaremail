import { useEffect, useState } from "react";

/** Matches Tailwind `md` (768px). Below this, the mail shell uses a single-column layout. */
export const MOBILE_BREAKPOINT_PX = 768;

function getMatches(breakpoint: number): boolean {
	if (typeof window === "undefined") {
		return false;
	}
	return window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches;
}

/**
 * True when the viewport is narrower than the given breakpoint (default: Tailwind `md`).
 * Subscribes to `matchMedia` so layout switches without a full remount of unrelated trees.
 */
export function useIsMobile(breakpoint = MOBILE_BREAKPOINT_PX): boolean {
	const [isMobile, setIsMobile] = useState(() => getMatches(breakpoint));

	useEffect(() => {
		const mediaQuery = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
		const onChange = () => setIsMobile(mediaQuery.matches);
		onChange();
		mediaQuery.addEventListener("change", onChange);
		return () => mediaQuery.removeEventListener("change", onChange);
	}, [breakpoint]);

	return isMobile;
}
