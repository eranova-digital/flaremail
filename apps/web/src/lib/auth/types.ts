export type AccountProfile = {
	firstName: string | null;
	lastName: string | null;
	recoveryAddress: string | null;
	phone: string | null;
	address: {
		country: string | null;
		state: string | null;
		city: string | null;
		line1: string | null;
		line2: string | null;
	};
};

export type Account = {
	id: string;
	isIntendant: boolean;
	role: string | null;
	status: string;
	loginIdentifier: string;
	primaryMailboxId: string | null;
	profile: AccountProfile | null;
	lockedFields?: string[];
	displayName?: string;
};
