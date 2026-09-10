import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { ApiError, apiRequest } from "../../src/core/api-client.js";
import { MemorySessionStorage } from "../helpers/session-storage.js";

const originalFetch = globalThis.fetch;
const validError = (payload) => Boolean(payload?.error?.code && payload?.error?.message);

beforeEach(() => { globalThis.sessionStorage = new MemorySessionStorage(); });
afterEach(() => { globalThis.fetch = originalFetch; });

test("returns a response only after runtime validation", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ value: 1 }), { status: 200 });
  const payload = await apiRequest("/example", { validate: (value) => value?.value === 1, validateError: validError });
  assert.deepEqual(payload, { value: 1 });
});

test("rejects successful responses that violate the contract", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ unexpected: true }), { status: 200 });
  await assert.rejects(
    apiRequest("/example", { validate: () => false, validateError: validError }),
    (error) => error instanceof ApiError && error.code === "contract_response_invalid",
  );
});

test("normalizes a valid API error envelope", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: "duplicate_enrolment", message: "Already enrolled" } }), { status: 409 });
  await assert.rejects(
    apiRequest("/example", { validate: () => true, validateError: validError }),
    (error) => error instanceof ApiError && error.status === 409 && error.code === "duplicate_enrolment" && error.message === "Already enrolled",
  );
});

test("rejects malformed API errors at the contract boundary", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ message: "No envelope" }), { status: 500 });
  await assert.rejects(
    apiRequest("/example", { validate: () => true, validateError: validError }),
    (error) => error instanceof ApiError && error.code === "contract_response_invalid",
  );
});

test("distinguishes timeouts from caller cancellation", async () => {
  globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  });
  await assert.rejects(
    apiRequest("/slow", { timeoutMs: 1, validate: () => true, validateError: validError }),
    (error) => error instanceof ApiError && error.code === "request_timeout",
  );
  const controller = new AbortController();
  const pending = apiRequest("/cancelled", { signal: controller.signal, timeoutMs: 1000, validate: () => true, validateError: validError });
  controller.abort();
  await assert.rejects(pending, (error) => error instanceof ApiError && error.code === "request_cancelled");
});
