// @ts-check

/**
 * Create a small JSON document store backed by sessionStorage.
 * Feature fixture providers share a key but update only the fields they own.
 *
 * @template {Record<string, unknown>} T
 * @param {string} key
 * @param {T} defaults
 */
export function createSessionDocumentStore(key, defaults) {
  return Object.freeze({
    read() {
      try {
        const saved = JSON.parse(sessionStorage.getItem(key) || "null");
        return /** @type {T} */ ({ ...defaults, ...(saved || {}) });
      } catch {
        return { ...defaults };
      }
    },
    /** @param {(current: T) => T} change */
    update(change) {
      const next = change(this.read());
      sessionStorage.setItem(key, JSON.stringify(next));
      return next;
    },
    clear() {
      sessionStorage.removeItem(key);
    },
  });
}
