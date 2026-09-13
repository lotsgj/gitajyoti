// @ts-check
import { config } from "../config.js";
import { clearSession, getAccessToken } from "./session.js";

/** @typedef {((value:unknown)=>boolean) & {errors?:unknown}} RuntimeValidator */

export class ApiError extends Error {
  /** @param {string} message @param {{status?:number,code?:string,details?:unknown,cause?:unknown}} options */
  constructor(message, { status = 0, code = "request_failed", details = null, cause } = {}) {
    super(message, { cause }); this.name = "ApiError"; this.status = status; this.code = code; this.details = details;
  }
}

/** @typedef {{status:number,data:unknown,etag:string|null}} ApiResponseMetadata */
/** @param {string} path @param {{method?:string,body?:unknown,signal?:AbortSignal,authenticated?:boolean,validate?:RuntimeValidator,validateError?:RuntimeValidator,timeoutMs?:number,ifNoneMatch?:string,metadata?:boolean}} options */
export async function apiRequest(path, { method = "GET", body, signal, authenticated = false, validate, validateError, timeoutMs = config.requestTimeoutMs, ifNoneMatch, metadata = false } = {}) {
  /** @type {Record<string,string>} */
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (ifNoneMatch) headers["If-None-Match"] = ifNoneMatch;
  if (authenticated) {
    const token = getAccessToken();
    if (!token) throw new ApiError("Please sign in to continue.", { status: 401, code: "authentication_required" });
    headers.Authorization = `Bearer ${token}`;
  }
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort(signal?.reason);
  if (signal?.aborted) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  let response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
  } catch (cause) {
    if (timedOut) throw new ApiError("The MyGita service took too long to respond.", { code: "request_timeout", cause });
    if (controller.signal.aborted) throw new ApiError("The request was cancelled.", { code: "request_cancelled", cause });
    throw new ApiError("The MyGita service could not be reached.", { code: "network_error", cause });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
  if (response.status === 304 && metadata) return { status: 304, data: null, etag: response.headers.get("ETag") };
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) clearSession();
    if (!validateError?.(payload)) {
      throw new ApiError("The MyGita service returned an invalid error response.", { status: response.status, code: "contract_response_invalid", details: validateError?.errors });
    }
    const problem = payload.error;
    throw new ApiError(problem.message || "The request could not be completed.", { status: response.status, code: problem.code, details: problem.details });
  }
  if (!validate?.(payload)) {
    throw new ApiError("The MyGita service returned data that does not match its contract.", { status: response.status, code: "contract_response_invalid", details: validate?.errors });
  }
  return metadata ? { status: response.status, data: payload, etag: response.headers.get("ETag") } : payload;
}
