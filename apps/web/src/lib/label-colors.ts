export const LABEL_COLORS = [
	"#ef4444",
	"#f97316",
	"#eab308",
	"#22c55e",
	"#3b82f6",
	"#8b5cf6",
	"#ec4899",
	"#6b7280",
] as const;

export const DEFAULT_LABEL_COLOR = LABEL_COLORS[4];

export function labelColorStyle(color?: string | null): { backgroundColor: string } {
	return { backgroundColor: color ?? DEFAULT_LABEL_COLOR };
}
