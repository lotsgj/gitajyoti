import assert from "node:assert/strict";
import { test } from "node:test";

import { createAccountPage, onboardingPage, signInPage } from "../../src/pages/authentication-page.js";

test("sign in presents password authentication as the primary path", () => {
  const page = signInPage();
  assert.match(page, /data-form="password-login"/);
  assert.match(page, /Create an account/);
  assert.doesNotMatch(page, /Mobile \+ OTP/);
});

test("account creation collects username and a confirmed password", () => {
  const page = createAccountPage();
  assert.match(page, /data-form="password-account"/);
  assert.match(page, /name="username"/);
  assert.match(page, /name="password"/);
  assert.match(page, /name="confirmPassword"/);
  assert.match(page, /minlength="15"/);
});

test("profile setup is optional after Account creation", () => {
  const page = onboardingPage();
  assert.match(page, /My profile/);
  assert.match(page, /data-action="skip-profile"/);
  assert.match(page, /return here anytime/);
});
