import { useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ProfileAvatar } from "@/components/ProfileAvatar";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api";
import { getErrorMessage } from "@/lib/api/errors";
import type { ProfilePicture } from "@/lib/profile-picture";

type ProfilePictureControlsProps = {
	accountId: string;
	loginIdentifier: string;
	displayName: string;
	profilePicture: ProfilePicture | null;
	avatarClassName?: string;
	disabled?: boolean;
	useAccountScope?: boolean;
	details?: ReactNode;
	onUpdated?: () => void | Promise<void>;
};

function profilePictureEndpoint(accountId: string, useAccountScope: boolean) {
	if (useAccountScope) {
		return apiUrl(`/accounts/${accountId}/profile-picture`);
	}
	return apiUrl("/auth/me/profile-picture");
}

export function ProfilePictureControls({
	accountId,
	loginIdentifier,
	displayName,
	profilePicture,
	avatarClassName = "size-16 text-lg",
	disabled = false,
	useAccountScope = false,
	details,
	onUpdated,
}: ProfilePictureControlsProps) {
	const { t } = useTranslation("settings");
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleUpload = async (file: File) => {
		setBusy(true);
		setError(null);
		try {
			const formData = new FormData();
			formData.append("file", file);
			const response = await fetch(
				profilePictureEndpoint(accountId, useAccountScope),
				{
					method: "PUT",
					credentials: "include",
					body: formData,
				},
			);
			if (!response.ok) {
				const body = await response.json().catch(() => null);
				throw new Error(getErrorMessage(body) ?? t("profile.picture.uploadFailed"));
			}
			await onUpdated?.();
		} catch (err) {
			setError(getErrorMessage(err));
		} finally {
			setBusy(false);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		}
	};

	const handleRemove = async () => {
		setBusy(true);
		setError(null);
		try {
			const response = await fetch(
				profilePictureEndpoint(accountId, useAccountScope),
				{
					method: "DELETE",
					credentials: "include",
				},
			);
			if (!response.ok) {
				const body = await response.json().catch(() => null);
				throw new Error(getErrorMessage(body) ?? t("profile.picture.removeFailed"));
			}
			await onUpdated?.();
		} catch (err) {
			setError(getErrorMessage(err));
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex items-start gap-4">
			<ProfileAvatar
				accountId={accountId}
				seed={loginIdentifier}
				label={displayName}
				profilePicture={profilePicture}
				className={avatarClassName}
			/>
			<div className="min-w-0 flex-1">
				{details ? <div className="mb-2">{details}</div> : null}
				<div className="flex flex-wrap items-center gap-2">
					<input
						ref={fileInputRef}
						type="file"
						accept="image/jpeg,image/png,image/webp"
						className="sr-only"
						disabled={disabled || busy}
						onChange={(event) => {
							const file = event.target.files?.[0];
							if (file) {
								void handleUpload(file);
							}
						}}
					/>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={disabled || busy}
						onClick={() => fileInputRef.current?.click()}
					>
						{busy ? (
							<Loader2 className="size-4 animate-spin" aria-hidden />
						) : null}
						{profilePicture
							? t("profile.picture.change")
							: t("profile.picture.upload")}
					</Button>
					{profilePicture ? (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							disabled={disabled || busy}
							onClick={() => void handleRemove()}
						>
							{t("profile.picture.remove")}
						</Button>
					) : null}
				</div>
				{error ? (
					<p className="text-destructive mt-2 text-sm">{error}</p>
				) : null}
			</div>
		</div>
	);
}
