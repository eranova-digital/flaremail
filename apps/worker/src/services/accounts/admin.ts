import type { Database } from "../../db/client";
import { authorizeAccount } from "../../lib/auth/access";
import type { Principal } from "../../lib/auth/types";
import { createPasswordResetCode } from "../auth";
import {
	listActiveSessions,
	revokeAllSessions,
	revokeSession,
} from "../auth-session";
import { adminDisableMfa, getMfaStatus } from "../mfa";

export async function adminCreatePasswordResetCode(
	db: Database,
	principal: Principal,
	accountId: string,
) {
	if (!principal.accountId) {
		throw new Error("Authentication required");
	}
	await authorizeAccount(db, principal, accountId, "manage");
	return createPasswordResetCode(db, {
		accountId,
		createdByAccountId: principal.accountId,
	});
}

export async function adminListAccountSessions(
	db: Database,
	principal: Principal,
	accountId: string,
) {
	await authorizeAccount(db, principal, accountId, "manage_security");
	return listActiveSessions(db, accountId);
}

export async function adminRevokeAccountSession(
	db: Database,
	principal: Principal,
	accountId: string,
	sessionId: string,
) {
	await authorizeAccount(db, principal, accountId, "manage_security");
	await revokeSession(db, accountId, sessionId);
}

export async function adminRevokeAllAccountSessions(
	db: Database,
	principal: Principal,
	accountId: string,
) {
	await authorizeAccount(db, principal, accountId, "manage_security");
	await revokeAllSessions(db, accountId, { includeCurrent: true });
}

export async function adminGetAccountMfaStatus(
	db: Database,
	principal: Principal,
	accountId: string,
) {
	await authorizeAccount(db, principal, accountId, "manage_security");
	return getMfaStatus(db, accountId);
}

export async function adminDisableAccountMfa(
	db: Database,
	principal: Principal,
	accountId: string,
) {
	await authorizeAccount(db, principal, accountId, "manage_security");
	return adminDisableMfa(db, accountId);
}
