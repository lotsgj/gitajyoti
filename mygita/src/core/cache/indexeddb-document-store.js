// @ts-check
import { cloneDocument } from "./document-store.js";

const OBJECT_STORE = "documents";

/** @template T @param {IDBRequest<T>} request @returns {Promise<T>} */
function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error || new Error("IndexedDB request failed.")), { once: true });
  });
}

/** @param {IDBTransaction} transaction @returns {Promise<void>} */
function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener("abort", () => reject(transaction.error || new Error("IndexedDB transaction was aborted.")), { once: true });
    transaction.addEventListener("error", () => reject(transaction.error || new Error("IndexedDB transaction failed.")), { once: true });
  });
}

/**
 * @param {{databaseName?:string,databaseVersion?:number,indexedDB?:IDBFactory}} [options]
 * @returns {import('./document-store.js').AsyncDocumentStore}
 */
export function createIndexedDbDocumentStore({
  databaseName = "mygita-data-cache",
  databaseVersion = 1,
  indexedDB = globalThis.indexedDB,
} = {}) {
  if (!indexedDB) throw new Error("IndexedDB is unavailable in this browser.");
  const opened = indexedDB.open(databaseName, databaseVersion);
  opened.addEventListener("upgradeneeded", () => {
    if (!opened.result.objectStoreNames.contains(OBJECT_STORE)) opened.result.createObjectStore(OBJECT_STORE);
  });
  const database = requestResult(opened);

  return Object.freeze({
    async get(key) {
      const db = await database;
      const transaction = db.transaction(OBJECT_STORE, "readonly");
      return cloneDocument(await requestResult(transaction.objectStore(OBJECT_STORE).get(key)));
    },
    async set(key, value) {
      const db = await database;
      const transaction = db.transaction(OBJECT_STORE, "readwrite");
      transaction.objectStore(OBJECT_STORE).put(cloneDocument(value), key);
      await transactionDone(transaction);
    },
    async delete(key) {
      const db = await database;
      const transaction = db.transaction(OBJECT_STORE, "readwrite");
      transaction.objectStore(OBJECT_STORE).delete(key);
      await transactionDone(transaction);
    },
    async deletePrefix(prefix) {
      const db = await database;
      const transaction = db.transaction(OBJECT_STORE, "readwrite");
      const request = transaction.objectStore(OBJECT_STORE).openKeyCursor();
      request.addEventListener("success", () => {
        const cursor = request.result;
        if (!cursor) return;
        if (typeof cursor.key === "string" && cursor.key.startsWith(prefix)) cursor.delete();
        cursor.continue();
      });
      await transactionDone(transaction);
    },
  });
}
