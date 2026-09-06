export class SearchQueryError extends Error {
	readonly code: string;

	constructor(message: string, code = "invalid-search-query") {
		super(message);
		this.name = "SearchQueryError";
		this.code = code;
	}
}

