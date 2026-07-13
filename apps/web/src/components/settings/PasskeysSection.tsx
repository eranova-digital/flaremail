import { useEffect, useState } from 'react';
import { Fingerprint, Loader2, Trash2 } from 'lucide-react';

import { PasswordInput } from '@/components/auth/PasswordInput';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fetchPasskeys, removePasskey } from '@/lib/auth/api';
import { registerPasskey } from '@/lib/auth/passkeys';
import { isPasskeySupported } from '@/lib/auth/passkey-support';
import type { PasskeySummary } from '@/lib/auth/types';
import { getErrorMessage } from '@/lib/api/errors';

function formatPasskeyDate(value: string | null): string | null {
	if (!value) {
		return null;
	}
	return new Date(value).toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	});
}

function passkeyLabel(passkey: PasskeySummary, index: number): string {
	return passkey.name?.trim() || `Passkey ${index + 1}`;
}

export function PasskeysSection() {
	const supported = isPasskeySupported();
	const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [newPasskeyName, setNewPasskeyName] = useState('');
	const [removingId, setRemovingId] = useState<string | null>(null);
	const [removePassword, setRemovePassword] = useState('');

	useEffect(() => {
		if (!supported) {
			setLoading(false);
			return;
		}

		let cancelled = false;

		(async () => {
			try {
				const result = await fetchPasskeys();
				if (!cancelled) {
					setPasskeys(result.items);
				}
			} catch (loadError) {
				if (!cancelled) {
					setError(getErrorMessage(loadError));
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [supported]);

	const resetMessages = () => {
		setError(null);
		setSuccess(null);
	};

	const handleAddPasskey = async () => {
		resetMessages();
		setSubmitting(true);
		try {
			const result = await registerPasskey(newPasskeyName.trim() || undefined);
			setPasskeys(result.items);
			setNewPasskeyName('');
			setSuccess('Passkey added successfully.');
		} catch (addError) {
			setError(getErrorMessage(addError));
		} finally {
			setSubmitting(false);
		}
	};

	const handleRemovePasskey = async (passkeyId: string) => {
		resetMessages();
		setSubmitting(true);
		try {
			const result = await removePasskey({
				passkeyId,
				password: removePassword,
			});
			setPasskeys(result.items);
			setRemovingId(null);
			setRemovePassword('');
			setSuccess('Passkey removed.');
		} catch (removeError) {
			setError(getErrorMessage(removeError));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Card className="rounded-xl shadow-sm">
			<CardHeader className="pb-4">
				<CardTitle className="flex items-center gap-2 text-base">
					<Fingerprint className="text-primary size-4" aria-hidden />
					Passkeys
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{error ? <Alert tone="destructive">{error}</Alert> : null}
				{success ? <Alert tone="success">{success}</Alert> : null}
				{!supported ? (
					<p className="text-muted-foreground text-sm">Passkeys are not supported in this browser.</p>
				) : loading ? (
					<p className="text-muted-foreground text-sm">Loading passkeys…</p>
				) : (
					<>
						<p className="text-muted-foreground text-sm">Sign in with your fingerprint, face, or device PIN.</p>

						{passkeys.length > 0 ? (
							<ul className="divide-y rounded-md border">
								{passkeys.map((passkey, index) => {
									const createdAt = formatPasskeyDate(passkey.createdAt);
									const lastUsedAt = formatPasskeyDate(passkey.lastUsedAt);
									const isRemoving = removingId === passkey.id;

									return (
										<li key={passkey.id} className="px-3 py-3">
											<div className="flex items-start justify-between gap-3">
												<div className="min-w-0 space-y-1">
													<p className="text-sm font-medium">{passkeyLabel(passkey, index)}</p>
													<p className="text-muted-foreground text-xs">
														Added {createdAt ?? 'recently'}
														{lastUsedAt ? ` · Last used ${lastUsedAt}` : ''}
													</p>
												</div>
												<Button
													type="button"
													variant="ghost"
													size="icon-xs"
													onClick={() => {
														setRemovingId(isRemoving ? null : passkey.id);
														setRemovePassword('');
														resetMessages();
													}}
													disabled={submitting}
													aria-label={`Remove ${passkeyLabel(passkey, index)}`}
												>
													<Trash2 className="size-4" aria-hidden />
												</Button>
											</div>
											{isRemoving ? (
												<div className="mt-3 space-y-3 border-t pt-3">
													<p className="text-muted-foreground text-sm">Enter your password to remove this passkey.</p>
													<div className="grid gap-3 sm:max-w-sm">
														<PasswordInput
															id={`remove-passkey-${passkey.id}`}
															value={removePassword}
															onChange={(event) => setRemovePassword(event.target.value)}
															disabled={submitting}
															autoComplete="current-password"
														/>
														<div className="flex flex-wrap gap-2">
															<Button
																variant="destructive"
																size="sm"
																onClick={() => void handleRemovePasskey(passkey.id)}
																disabled={submitting || removePassword.length === 0}
															>
																{submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
																Remove passkey
															</Button>
															<Button
																variant="outline"
																size="sm"
																onClick={() => {
																	setRemovingId(null);
																	setRemovePassword('');
																}}
																disabled={submitting}
															>
																Cancel
															</Button>
														</div>
													</div>
												</div>
											) : null}
										</li>
									);
								})}
							</ul>
						) : (
							<p className="text-muted-foreground text-sm">No passkeys registered yet.</p>
						)}

						<div className="grid gap-3 sm:max-w-sm">
							<div className="space-y-2">
								<label htmlFor="passkey-name" className="text-sm font-medium">
									Passkey name (optional)
								</label>
								<Input
									id="passkey-name"
									placeholder="MacBook Touch ID"
									value={newPasskeyName}
									onChange={(event) => setNewPasskeyName(event.target.value)}
									disabled={submitting}
								/>
							</div>
							<Button onClick={() => void handleAddPasskey()} disabled={submitting}>
								{submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
								Add passkey
							</Button>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}
