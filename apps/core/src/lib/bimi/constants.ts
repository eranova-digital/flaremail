import {
	PROFILE_PICTURE_LARGE_SIZE,
	PROFILE_PICTURE_SMALL_SIZE,
} from "../profile-picture/keys";

/** Positive cache TTL when a BIMI logo was found and stored. */
export const BIMI_POSITIVE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Negative cache TTL when no usable BIMI assertion / logo was found. */
export const BIMI_NEGATIVE_TTL_MS = 24 * 60 * 60 * 1000;

export const BIMI_SELECTOR = "default";

export const BIMI_LOGO_SMALL_SIZE = PROFILE_PICTURE_SMALL_SIZE;
export const BIMI_LOGO_LARGE_SIZE = PROFILE_PICTURE_LARGE_SIZE;

export const BIMI_SVG_MAX_BYTES = 32 * 1024;
export const BIMI_FETCH_TIMEOUT_MS = 10_000;
export const BIMI_FETCH_MAX_REDIRECTS = 3;
