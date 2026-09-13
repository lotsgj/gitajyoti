// @ts-check
import { cloneDocument } from "./document-store.js";

/** @returns {import('./document-store.js').AsyncDocumentStore} */
export function createMemoryDocumentStore() {
  const documents = new Map();
  return Object.freeze({
    async get(key) { return cloneDocument(documents.get(key)); },
    async set(key, value) { documents.set(key, cloneDocument(value)); },
    async delete(key) { documents.delete(key); },
    async deletePrefix(prefix) {
      for (const key of documents.keys()) if (key.startsWith(prefix)) documents.delete(key);
    },
  });
}
