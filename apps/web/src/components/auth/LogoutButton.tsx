import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/utils";

type LogoutButtonProps = {
	className?: string;
};

export function LogoutButton({ className }: LogoutButtonProps) {
	const { t } = useTranslation("auth");
	const { signOut } = useAuth();
	const navigate = useNavigate();
	const [submitting, setSubmitting] = useState(false);
	const label = t("logout.signOut");

	const handleClick = async () => {
		setSubmitting(true);
		try {
			await signOut();
			navigate("/login", { replace: true });
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Button
			variant="ghost"
			size="sm"
			onClick={handleClick}
			disabled={submitting}
			aria-label={label}
			className={cn("px-2 sm:px-3", className)}
		>
			<LogOut className="size-4" />
			<span className="hidden sm:inline">{label}</span>
		</Button>
	);
}
