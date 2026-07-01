export function outboundContext(env: Env) {
	return {
		bucket: env.BUCKET,
		email: env.EMAIL,
	};
}
