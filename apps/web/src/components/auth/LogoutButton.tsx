import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/utils";

type LogoutButtonProps = {
	variant?: "sidebar" | "settings";
	className?: string;
	showLabel?: boolean;
};

export function LogoutButton({
	variant = "sidebar",
	className,
	showLabel = true,
}: LogoutButtonProps) {
	const { signOut } = useAuth();
	const navigate = useNavigate();
	const [submitting, setSubmitting] = useState(false);

	const handleClick = async () => {
		setSubmitting(true);
		try {
			await signOut();
			navigate("/login", { replace: true });
		} finally {
			setSubmitting(false);
		}
	};

	if (variant === "settings") {
		return (
			<Button
				variant="outline"
				size="sm"
				onClick={handleClick}
				disabled={submitting}
				className={className}
			>
				<LogOut className="size-4" />
				Sign out
			</Button>
		);
	}

	return (
		<Button
			variant="ghost"
			onClick={handleClick}
			disabled={submitting}
			className={cn(
				"hover:bg-accent flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
				!showLabel && "justify-center px-0",
				className,
			)}
		>
			<LogOut className="size-4 shrink-0" />
			{showLabel ? "Sign out" : null}
		</Button>
	);
}
