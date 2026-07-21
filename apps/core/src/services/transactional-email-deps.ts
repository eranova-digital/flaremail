import type { TransactionalEmailDeps } from "../lib/auth/transactional-email";
import type { ResolveIdentityForSend } from "../lib/messages/outbound-context";
import { resolveIdentityForSend } from "./identities";

export function createResolveIdentityForSend(): ResolveIdentityForSend {
	return async (db, principal, mailboxId, identityId) => {
		const { fromName } = await resolveIdentityForSend(
			db,
			principal,
			mailboxId,
			identityId,
		);
		return { fromName };
	};
}

export function createTransactionalEmailDeps(
	env: Pick<Env, "EMAIL" | "BUCKET">,
): TransactionalEmailDeps {
	return {
		email: env.EMAIL,
		bucket: env.BUCKET,
		resolveIdentityForSend: createResolveIdentityForSend(),
	};
}
