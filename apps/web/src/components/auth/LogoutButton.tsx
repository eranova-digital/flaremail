import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthProvider";

type LogoutButtonProps = {
	className?: string;
};

export function LogoutButton({ className }: LogoutButtonProps) {
	const { t } = useTranslation("auth");
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

	return (
		<Button
			variant="outline"
			size="sm"
			onClick={handleClick}
			disabled={submitting}
			className={className}
		>
			<LogOut className="size-4" />
			{t("logout.signOut")}
		</Button>
	);
}
