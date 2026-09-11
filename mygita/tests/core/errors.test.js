import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiError } from "../../src/core/api-client.js";
import { isAuthenticationError, isCancellation, userMessageForError } from "../../src/core/errors.js";

test("maps contract error codes to stable user-facing messages", () => {
  assert.equal(userMessageForError(new ApiError("server wording",{code:"username_unavailable"})),"That username is unavailable. Please choose another.");
  assert.equal(userMessageForError(new ApiError("server wording",{code:"login_rate_limited"})),"Too many sign-in attempts. Please wait and try again.");
  assert.equal(userMessageForError(new ApiError("server wording",{code:"network_error"})),"MyGita could not connect. Check your connection and try again.");
});

test("classifies authentication and cancellation failures", () => {
  assert.equal(isAuthenticationError(new ApiError("expired",{code:"invalid_token"})),true);
  assert.equal(isAuthenticationError(new ApiError("wrong password",{code:"invalid_credentials"})),false);
  assert.equal(isCancellation(new ApiError("cancelled",{code:"request_cancelled"})),true);
});
