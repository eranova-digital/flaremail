// Browser shim for Node's "module" builtin.
// email-reply-parser calls createRequire(import.meta.url) at module load time to
// optionally require("re2"). In the browser there is no require, so we return a
// stub that throws, which triggers the library's graceful fallback to native RegExp.
export function createRequire(): (id: string) => never {
	return (id: string) => {
		throw new Error(`Cannot require "${id}" in the browser`);
	};
}

export default { createRequire };
