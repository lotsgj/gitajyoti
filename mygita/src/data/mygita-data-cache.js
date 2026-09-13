// @ts-check
import { createIndexedDbDocumentStore } from "../core/cache/indexeddb-document-store.js";
import { createMemoryDocumentStore } from "../core/cache/memory-document-store.js";
import { createVersionedCache } from "../core/cache/versioned-cache.js";

const FORBIDDEN_PRIVATE_FIELD = /(password|hash|otp|challenge|recovery|authorization|access.?token|refresh.?token)/i;

/** @param {unknown} value @param {WeakSet<object>} [visited] */
export function assertCacheSafe(value, visited = new WeakSet()) {
  if (!value || typeof value !== "object") return;
  if (visited.has(value)) return;
  visited.add(value);
  if (Array.isArray(value)) {
    for (const item of value) assertCacheSafe(item, visited);
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN_PRIVATE_FIELD.test(key)) throw new Error(`Sensitive field cannot be cached: ${key}`);
    assertCacheSafe(item, visited);
  }
}

/**
 * @param {import('../core/cache/document-store.js').AsyncDocumentStore} store
 * @param {{schemaVersion?:number,now?:()=>number}} [options]
 */
export function createMyGitaDataCache(store, { schemaVersion = 1, now = Date.now } = {}) {
  const createArea = (namespace) => createVersionedCache({
    store,
    namespace,
    schemaVersion,
    now,
    accept: assertCacheSafe,
  });
  const publicData = Object.freeze({
    catalogue: createArea("public:catalogue"),
    experienceDetails: createArea("public:experience-details"),
  });
  const accountAreas = new Map();

  /** @param {string} accountId */
  function forAccount(accountId) {
    const normalized = accountId.trim();
    if (!normalized) throw new Error("An Account ID is required for private cache data.");
    const existing = accountAreas.get(normalized);
    if (existing) return existing;
    const prefix = `private:${encodeURIComponent(normalized)}`;
    const areas = Object.freeze({
      manifest: createArea(`${prefix}:manifest`),
      profile: createArea(`${prefix}:profile`),
      journey: createArea(`${prefix}:journey`),
      interests: createArea(`${prefix}:interests`),
      activityState: createArea(`${prefix}:activity-state`),
    });
    accountAreas.set(normalized, areas);
    return areas;
  }

  return Object.freeze({
    public: publicData,
    forAccount,
    /** Clear private memory on sign-out while retaining isolated durable records for a later login. @param {string} accountId */
    releaseAccount(accountId) {
      const areas = accountAreas.get(accountId);
      if (!areas) return;
      for (const area of Object.values(areas)) area.clearMemory();
      accountAreas.delete(accountId);
    },
    /** Permanently remove one Account's locally cached projections. @param {string} accountId */
    async deleteAccount(accountId) {
      const areas = forAccount(accountId);
      await Promise.all(Object.values(areas).map((area) => area.clear()));
      accountAreas.delete(accountId);
    },
  });
}

/** Create the browser cache without activating it in current page repositories. */
export function createBrowserMyGitaDataCache() {
  return createMyGitaDataCache(globalThis.indexedDB?createIndexedDbDocumentStore():createMemoryDocumentStore());
}

let browserCache;
export function getBrowserMyGitaDataCache() {
  return browserCache ||= createBrowserMyGitaDataCache();
}
