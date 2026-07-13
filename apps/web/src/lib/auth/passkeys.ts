import {
	startAuthentication,
	startRegistration,
} from "@simplewebauthn/browser";

import {
	beginPasskeyRegistration,
	beginPasskeySignIn,
	completePasskeyRegistration,
	completePasskeySignIn,
} from "@/lib/auth/api";

export async function registerPasskey(name?: string) {
	const { options, challengeToken } = await beginPasskeyRegistration();
	const response = await startRegistration({ optionsJSON: options });
	return completePasskeyRegistration({
		challengeToken,
		response,
		name,
	});
}

export async function signInWithPasskey(email?: string) {
	const { options, challengeToken } = await beginPasskeySignIn(email?.trim() || undefined);
	const response = await startAuthentication({ optionsJSON: options });
	await completePasskeySignIn({
		challengeToken,
		response,
	});
}
