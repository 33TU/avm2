/** A stable reference whose view follows a ByteArray's backing buffer. */
export interface ByteArrayStorage {
	view: DataView;
}

/** Stable for a domain's lifetime; rebinding replaces its storage reference. */
export interface DomainMemoryBinding {
	storage: ByteArrayStorage;
}
