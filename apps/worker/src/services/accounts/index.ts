export {
	PROFILE_LOCKABLE_FIELDS,
	type ProfileLockableField,
	type AccountProfileInput,
} from "./shared";
export { listAccountsForPrincipal } from "./list";
export { inviteAccount, regenerateInviteCode } from "./invite";
export {
	loadProfileLocks,
	getAccountDetail,
	updateAccountProfile,
} from "./profile";
export {
	assignRole,
	suspendAccount,
	unsuspendAccount,
	removeAccount,
} from "./lifecycle";
export { updateAccountAssignments } from "./assignments";
export {
	getDomainLocalPartPolicy,
	updateDomainLocalPartPolicy,
	suggestInviteLocalPart,
} from "./local-part-policy";
export {
	grantMailboxAccess,
	listMailboxGrantHolders,
	grantSharedMailboxAccess,
	revokeSharedMailboxAccess,
} from "./mailbox-grants";
export {
	listMailboxManagerAssignments,
	grantManagerMailboxAssignment,
	revokeManagerMailboxAssignment,
} from "./manager-assignments";
