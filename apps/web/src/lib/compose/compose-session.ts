/**
 * Compose lifecycle invariants: draft identity, sealed-after-send, and
 * autosave eligibility live behind one module so hooks stay thin adapters.
 */
export class ComposeSession {
	private _draftId: string | null = null;
	private _sealed = false;

	constructor(initialDraftId: string | null = null) {
		this._draftId = initialDraftId;
	}

	get draftId(): string | null {
		return this._draftId;
	}

	get isSealed(): boolean {
		return this._sealed;
	}

	setDraftId(id: string | null): void {
		this._draftId = id;
	}

	/**
	 * Once send succeeds the draft is promoted — block further autosaves.
	 */
	seal(): void {
		this._sealed = true;
	}

	unseal(): void {
		this._sealed = false;
	}

	canAutosave(): boolean {
		return !this._sealed;
	}

	readDraftIdRef(): string | null {
		return this._draftId;
	}

	writeDraftIdRef(id: string | null): void {
		this._draftId = id;
	}
}
