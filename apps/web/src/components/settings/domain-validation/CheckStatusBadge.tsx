import { Badge } from "@/components/ui/badge";

export function CheckStatusBadge({
	status,
	tier,
}: {
	status?: string;
	tier?: string;
}) {
	if (status === "passed") {
		return <Badge variant="default">Passed</Badge>;
	}
	if (status === "failed") {
		return (
			<Badge variant={tier === "advisory" ? "secondary" : "outline"}>
				{tier === "advisory" ? "Advisory fail" : "Failed"}
			</Badge>
		);
	}
	if (status === "skipped") {
		return <Badge variant="secondary">Skipped</Badge>;
	}
	return <Badge variant="outline">Pending</Badge>;
}
