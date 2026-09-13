// @ts-check
import { cloneDocument } from "./document-store.js";

/** @typedef {{schemaVersion:number,recordVersion:string,fetchedAt:number,data:unknown}} CacheEnvelope */
/** @typedef {{recordVersion:string,fetchedAt:number,data:unknown}} CacheRecord */

/** @param {unknown} value @param {number} schemaVersion @returns {value is CacheEnvelope} */
function isEnvelope(value, schemaVersion) {
  if (!value || typeof value !== "object") return false;
  const candidate = /** @type {Record<string,unknown>} */ (value);
  return candidate.schemaVersion === schemaVersion
    && typeof candidate.recordVersion === "string"
    && candidate.recordVersion.length > 0
    && typeof candidate.fetchedAt === "number"
    && Number.isFinite(candidate.fetchedAt)
    && Object.hasOwn(candidate, "data");
}

/** @param {AbortSignal|undefined} signal */
function throwIfAborted(signal) {
  if (signal?.aborted) throw signal.reason || new DOMException("The operation was aborted.", "AbortError");
}

/**
 * @param {{
 *   store:import('./document-store.js').AsyncDocumentStore,
 *   namespace:string,
 *   schemaVersion?:number,
 *   now?:()=>number,
 *   accept?:(data:unknown)=>void
 * }} options
 */
export function createVersionedCache({ store, namespace, schemaVersion = 1, now = Date.now, accept = () => {} }) {
  if (!namespace) throw new Error("A cache namespace is required.");
  const prefix = `${namespace}:`;
  const memory = new Map();
  const inFlight = new Map();
  const storageKey = (key) => `${prefix}${key}`;

  /** @param {CacheEnvelope} envelope @returns {CacheRecord} */
  const toRecord = (envelope) => ({
    recordVersion: envelope.recordVersion,
    fetchedAt: envelope.fetchedAt,
    data: cloneDocument(envelope.data),
  });

  return Object.freeze({
    /** @param {string} key @param {{version?:string}} [options] @returns {Promise<CacheRecord|null>} */
    async read(key, { version } = {}) {
      const fullKey = storageKey(key);
      let envelope = memory.get(fullKey);
      if (!isEnvelope(envelope, schemaVersion)) {
        const persisted = await store.get(fullKey);
        if (!isEnvelope(persisted, schemaVersion)) {
          if (persisted !== undefined) await store.delete(fullKey);
          memory.delete(fullKey);
          return null;
        }
        envelope = persisted;
        memory.set(fullKey, cloneDocument(envelope));
      }
      if (version !== undefined && envelope.recordVersion !== version) return null;
      return toRecord(envelope);
    },
    /** @param {string} key @param {{recordVersion:string,data:unknown,fetchedAt?:number}} record */
    async write(key, { recordVersion, data, fetchedAt = now() }) {
      if (!recordVersion) throw new Error("A non-empty record version is required.");
      accept(data);
      const envelope = { schemaVersion, recordVersion, fetchedAt, data: cloneDocument(data) };
      const fullKey = storageKey(key);
      await store.set(fullKey, envelope);
      memory.set(fullKey, cloneDocument(envelope));
      return toRecord(envelope);
    },
    /**
     * @param {string} key
     * @param {{version:string,loader:(signal?:AbortSignal)=>Promise<unknown>,signal?:AbortSignal}} options
     * @returns {Promise<CacheRecord>}
     */
    async load(key, { version, loader, signal }) {
      throwIfAborted(signal);
      const cached = await this.read(key, { version });
      if (cached) return cached;
      const requestKey = `${storageKey(key)}@${version}`;
      const existing = inFlight.get(requestKey);
      if (existing) return existing;
      const pending = (async () => {
        const data = await loader(signal);
        throwIfAborted(signal);
        return this.write(key, { recordVersion: version, data });
      })();
      inFlight.set(requestKey, pending);
      try { return await pending; }
      finally { if (inFlight.get(requestKey) === pending) inFlight.delete(requestKey); }
    },
    async remove(key) {
      const fullKey = storageKey(key);
      memory.delete(fullKey);
      await store.delete(fullKey);
    },
    clearMemory() { memory.clear(); },
    async clear() {
      memory.clear();
      await store.deletePrefix(prefix);
    },
  });
}
