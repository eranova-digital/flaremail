export type SessionMetadata = {
	userAgent: string | null;
	ipAddress: string | null;
	countryCode: string | null;
};

export function extractSessionMetadata(request: Request): SessionMetadata {
	const forwardedFor = request.headers.get("X-Forwarded-For");
	const ipAddress =
		request.headers.get("CF-Connecting-IP") ??
		forwardedFor?.split(",")[0]?.trim() ??
		null;

	return {
		userAgent: request.headers.get("User-Agent"),
		ipAddress,
		countryCode: request.headers.get("CF-IPCountry"),
	};
}

export function parseUserAgent(userAgent: string | null): {
	browser: string | null;
	os: string | null;
} {
	if (!userAgent) {
		return { browser: null, os: null };
	}

	let os: string | null = null;
	if (/Windows NT/i.test(userAgent)) {
		os = "Windows";
	} else if (/Mac OS X/i.test(userAgent)) {
		os = "macOS";
	} else if (/Android/i.test(userAgent)) {
		os = "Android";
	} else if (/iPhone|iPad/i.test(userAgent)) {
		os = "iOS";
	} else if (/Linux/i.test(userAgent)) {
		os = "Linux";
	}

	let browser: string | null = null;
	if (/Edg\//i.test(userAgent)) {
		browser = "Edge";
	} else if (/Chrome\//i.test(userAgent) && !/Edg\//i.test(userAgent)) {
		browser = "Chrome";
	} else if (/Firefox\//i.test(userAgent)) {
		browser = "Firefox";
	} else if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) {
		browser = "Safari";
	}

	return { browser, os };
}
