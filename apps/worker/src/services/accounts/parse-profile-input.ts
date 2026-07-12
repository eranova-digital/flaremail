export function parseProfileInput(value: Record<string, unknown>) {
	const address =
		value.address && typeof value.address === "object"
			? (value.address as Record<string, unknown>)
			: null;

	return {
		firstName:
			typeof value.firstName === "string" ? value.firstName : undefined,
		lastName: typeof value.lastName === "string" ? value.lastName : undefined,
		recoveryAddress:
			value.recoveryAddress === null
				? null
				: typeof value.recoveryAddress === "string"
					? value.recoveryAddress
					: undefined,
		phone:
			value.phone === null
				? null
				: typeof value.phone === "string"
					? value.phone
					: undefined,
		addressCountry:
			address?.country === null
				? null
				: typeof address?.country === "string"
					? address.country
					: undefined,
		addressState:
			address?.state === null
				? null
				: typeof address?.state === "string"
					? address.state
					: undefined,
		addressCity:
			address?.city === null
				? null
				: typeof address?.city === "string"
					? address.city
					: undefined,
		addressLine1:
			address?.line1 === null
				? null
				: typeof address?.line1 === "string"
					? address.line1
					: undefined,
		addressLine2:
			address?.line2 === null
				? null
				: typeof address?.line2 === "string"
					? address.line2
					: undefined,
	};
}
