// @ts-check
import { config } from "../config.js";
import { clearSession, getAccessToken } from "./session.js";

export class ApiError extends Error {
  /** @param {string} message @param {{status?:number,code?:string,details?:unknown,cause?:unknown}} options */
  constructor(message, { status = 0, code = "request_failed", details = null, cause } = {}) {
    super(message, { cause }); this.name = "ApiError"; this.status = status; this.code = code; this.details = details;
  }
}

/** @param {string} path @param {{method?:string,body?:unknown,signal?:AbortSignal,authenticated?:boolean}} options */
export async function apiRequest(path, { method = "GET", body, signal, authenticated = false } = {}) {
  /** @type {Record<string,string>} */
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (authenticated) {
    const token = getAccessToken();
    if (!token) throw new ApiError("Please sign in to continue.", { status: 401, code: "authentication_required" });
    headers.Authorization = `Bearer ${token}`;
  }
  let response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal });
  } catch (cause) {
    throw new ApiError("The My Gita service could not be reached.", { code: "network_error", cause });
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) clearSession();
    const problem = payload?.error || {};
    throw new ApiError(problem.message || "The request could not be completed.", { status: response.status, code: problem.code, details: problem.details });
  }
  return payload;
}
