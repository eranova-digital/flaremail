const UNITS = ["B", "KB", "MB", "GB"] as const;

export function formatFileSize(bytes?: number | null): string {
	if (bytes == null || bytes < 0) {
		return "";
	}

	if (bytes < 1024) {
		return `${bytes} B`;
	}

	const unitIndex = Math.min(
		Math.floor(Math.log(bytes) / Math.log(1024)),
		UNITS.length - 1,
	);
	const value = bytes / 1024 ** unitIndex;

	return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${UNITS[unitIndex]}`;
}
