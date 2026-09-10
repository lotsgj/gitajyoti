// @ts-check
import { apiRequest } from "../core/api-client.js";
import { validateErrorEnvelope } from "./generated/mygita-api-validators.js";

export * from "./generated/mygita-api-validators.js";

/** @param {string} path @param {Parameters<typeof apiRequest>[1]} options */
export function mygitaApiRequest(path, options = {}) {
  return apiRequest(path, { ...options, validateError: validateErrorEnvelope });
}
