// @ts-check

/**
 * @typedef {Object} AsyncDocumentStore
 * @property {(key:string) => Promise<unknown|undefined>} get
 * @property {(key:string,value:unknown) => Promise<void>} set
 * @property {(key:string) => Promise<void>} delete
 * @property {(prefix:string) => Promise<void>} deletePrefix
 */

/** @param {unknown} value */
export function cloneDocument(value) {
  return value === undefined ? undefined : structuredClone(value);
}

export {};
